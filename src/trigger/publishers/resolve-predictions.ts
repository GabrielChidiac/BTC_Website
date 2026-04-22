import { schedules, logger } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchBtcCloseAtDate } from "@/trigger/lib/coingecko";
import type { BriefingJSON } from "@/lib/types";

// ─── Resolution constants ─────────────────────────────────────────────────

// Flat band: within ±2% counts as "flat". Below this threshold in either
// direction, we call it up or down. Chosen to match how a holder actually
// experiences "did the market move?" over a multi-week horizon.
const FLAT_BAND_PCT = 2;

// Funding rate flat band in basis points. BTC perp funding typically sits
// in ±10 bps; a move under ±2 bps is noise relative to that baseline.
const FUNDING_FLAT_BAND_BPS = 2;

// ETF flow z-score flat band in standard deviations. A move under ±0.5 σ
// is typical intra-cycle drift; ≥0.5 σ indicates a real regime change.
const ETF_FLOW_FLAT_BAND_Z = 0.5;

// Metric keys we know how to auto-resolve. Any other metric is marked
// "inconclusive" with a note explaining why.
const METRIC_GROUPS = {
  btcPrice: new Set(["btc_price", "btc", "bitcoin_price", "price"]),
  dxy: new Set(["dxy", "dollar_index", "dollar", "usd_index"]),
  fundingRate: new Set(["funding_rate", "funding", "btc_funding"]),
  etfFlowZ: new Set([
    "etf_flow_z_score",
    "etf_flows",
    "etf_flow",
    "etf_inflows",
    "etf_net_flow",
  ]),
};

// ─── Row shape from Supabase ──────────────────────────────────────────────

interface PendingPredictionRow {
  id: string;
  briefing_date: string;
  claim_text: string;
  direction: "up" | "down" | "flat";
  metric: string;
  target_date: string;
}

// ─── Resolution outcome ───────────────────────────────────────────────────

type ResolutionOutcome =
  | { status: "correct" | "incorrect"; outcome: string }
  | { status: "inconclusive"; outcome: string };

// Resolve a single BTC-price prediction by fetching close prices on both
// the briefing date (entry) and the target date (exit), then comparing the
// percentage move against the prediction's direction.
async function resolveBtcPricePrediction(
  row: PendingPredictionRow
): Promise<ResolutionOutcome> {
  const entryResult = await fetchBtcCloseAtDate(row.briefing_date);
  if (entryResult.error || entryResult.data == null) {
    return {
      status: "inconclusive",
      outcome: `Could not fetch BTC close for briefing_date ${row.briefing_date}: ${entryResult.error ?? "no data"}`,
    };
  }

  const exitResult = await fetchBtcCloseAtDate(row.target_date);
  if (exitResult.error || exitResult.data == null) {
    return {
      status: "inconclusive",
      outcome: `Could not fetch BTC close for target_date ${row.target_date}: ${exitResult.error ?? "no data"}`,
    };
  }

  const entry = entryResult.data;
  const exit = exitResult.data;
  const pctMove = ((exit - entry) / entry) * 100;

  return classifyDirection({
    entryValue: entry,
    exitValue: exit,
    pctMove,
    flatBand: FLAT_BAND_PCT,
    claim: row.direction,
    descriptor: (v) => `$${Math.round(v).toLocaleString()}`,
    metricLabel: "BTC price",
    briefingDate: row.briefing_date,
    targetDate: row.target_date,
  });
}

// ─── Macro resolvers (read from persisted daily_briefings rows) ──────────

// Fetch a briefing's full JSON content from Supabase by date. Returns null
// if the row is missing or malformed — the caller treats that as inconclusive.
async function fetchBriefingContent(
  supabase: ReturnType<typeof createServiceClient>,
  date: string
): Promise<BriefingJSON | null> {
  const { data, error } = await supabase
    .from("daily_briefings")
    .select("content")
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return null;
  const content = (data as { content: BriefingJSON }).content;
  if (!content || typeof content !== "object") return null;
  return content;
}

// DXY direction: the YTD-percent change delta between briefing_date and
// target_date rows approximates the DXY move over that window. Not
// millimeter-precise, but sufficient for a direction-only call.
async function resolveDxyPrediction(
  supabase: ReturnType<typeof createServiceClient>,
  row: PendingPredictionRow
): Promise<ResolutionOutcome> {
  const [entryBriefing, exitBriefing] = await Promise.all([
    fetchBriefingContent(supabase, row.briefing_date),
    fetchBriefingContent(supabase, row.target_date),
  ]);

  if (!entryBriefing || !exitBriefing) {
    return {
      status: "inconclusive",
      outcome: `Missing briefing row for ${!entryBriefing ? row.briefing_date : row.target_date}. Cannot resolve DXY direction.`,
    };
  }

  const entryDxy = findAssetYtdPct(entryBriefing, "DXY", "Dollar Index");
  const exitDxy = findAssetYtdPct(exitBriefing, "DXY", "Dollar Index");
  if (entryDxy == null || exitDxy == null) {
    return {
      status: "inconclusive",
      outcome: `DXY change_ytd_pct not recorded on ${entryDxy == null ? row.briefing_date : row.target_date}.`,
    };
  }

  const pctMove = exitDxy - entryDxy;
  return classifyDirection({
    entryValue: entryDxy,
    exitValue: exitDxy,
    pctMove,
    flatBand: FLAT_BAND_PCT,
    claim: row.direction,
    descriptor: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}% YTD`,
    metricLabel: "DXY",
    briefingDate: row.briefing_date,
    targetDate: row.target_date,
  });
}

async function resolveFundingRatePrediction(
  supabase: ReturnType<typeof createServiceClient>,
  row: PendingPredictionRow
): Promise<ResolutionOutcome> {
  const [entryBriefing, exitBriefing] = await Promise.all([
    fetchBriefingContent(supabase, row.briefing_date),
    fetchBriefingContent(supabase, row.target_date),
  ]);

  if (!entryBriefing || !exitBriefing) {
    return {
      status: "inconclusive",
      outcome: `Missing briefing row for ${!entryBriefing ? row.briefing_date : row.target_date}. Cannot resolve funding rate.`,
    };
  }

  const entryRate = entryBriefing.funding_rate?.weighted_rate;
  const exitRate = exitBriefing.funding_rate?.weighted_rate;
  if (typeof entryRate !== "number" || typeof exitRate !== "number") {
    return {
      status: "inconclusive",
      outcome: `Funding rate not recorded on ${typeof entryRate !== "number" ? row.briefing_date : row.target_date}.`,
    };
  }

  // Convert decimal fractions to basis points for readability.
  const entryBps = entryRate * 10_000;
  const exitBps = exitRate * 10_000;
  const deltaBps = exitBps - entryBps;

  let actualDirection: "up" | "down" | "flat";
  if (Math.abs(deltaBps) < FUNDING_FLAT_BAND_BPS) {
    actualDirection = "flat";
  } else if (deltaBps > 0) {
    actualDirection = "up";
  } else {
    actualDirection = "down";
  }

  const correct = actualDirection === row.direction;
  const outcome = `Claim: ${row.direction}. Actual: ${actualDirection} (${entryBps.toFixed(1)} bps on ${row.briefing_date} → ${exitBps.toFixed(1)} bps on ${row.target_date}, Δ ${deltaBps >= 0 ? "+" : ""}${deltaBps.toFixed(1)} bps).`;
  return { status: correct ? "correct" : "incorrect", outcome };
}

async function resolveEtfFlowZScorePrediction(
  supabase: ReturnType<typeof createServiceClient>,
  row: PendingPredictionRow
): Promise<ResolutionOutcome> {
  const [entryBriefing, exitBriefing] = await Promise.all([
    fetchBriefingContent(supabase, row.briefing_date),
    fetchBriefingContent(supabase, row.target_date),
  ]);

  if (!entryBriefing || !exitBriefing) {
    return {
      status: "inconclusive",
      outcome: `Missing briefing row for ${!entryBriefing ? row.briefing_date : row.target_date}. Cannot resolve ETF flow z-score.`,
    };
  }

  const entryZ = entryBriefing.comparative?.etf_flows_30d_z_score;
  const exitZ = exitBriefing.comparative?.etf_flows_30d_z_score;
  if (typeof entryZ !== "number" || typeof exitZ !== "number") {
    return {
      status: "inconclusive",
      outcome: `ETF flow z-score not recorded on ${typeof entryZ !== "number" ? row.briefing_date : row.target_date}.`,
    };
  }

  const deltaZ = exitZ - entryZ;
  let actualDirection: "up" | "down" | "flat";
  if (Math.abs(deltaZ) < ETF_FLOW_FLAT_BAND_Z) {
    actualDirection = "flat";
  } else if (deltaZ > 0) {
    actualDirection = "up";
  } else {
    actualDirection = "down";
  }

  const correct = actualDirection === row.direction;
  const outcome = `Claim: ${row.direction}. Actual: ${actualDirection} (z-score ${entryZ.toFixed(2)} on ${row.briefing_date} → ${exitZ.toFixed(2)} on ${row.target_date}, Δ ${deltaZ >= 0 ? "+" : ""}${deltaZ.toFixed(2)} σ).`;
  return { status: correct ? "correct" : "incorrect", outcome };
}

// ─── Shared classification helper ────────────────────────────────────────

function classifyDirection(args: {
  entryValue: number;
  exitValue: number;
  pctMove: number;
  flatBand: number;
  claim: "up" | "down" | "flat";
  descriptor: (v: number) => string;
  metricLabel: string;
  briefingDate: string;
  targetDate: string;
}): ResolutionOutcome {
  const { entryValue, exitValue, pctMove, flatBand, claim, descriptor, metricLabel, briefingDate, targetDate } = args;

  let actualDirection: "up" | "down" | "flat";
  if (Math.abs(pctMove) < flatBand) {
    actualDirection = "flat";
  } else if (pctMove > 0) {
    actualDirection = "up";
  } else {
    actualDirection = "down";
  }

  const correct = actualDirection === claim;
  const outcome = `Claim: ${claim}. Actual: ${actualDirection} (${metricLabel} ${pctMove >= 0 ? "+" : ""}${pctMove.toFixed(2)}% from ${descriptor(entryValue)} on ${briefingDate} to ${descriptor(exitValue)} on ${targetDate}).`;

  return { status: correct ? "correct" : "incorrect", outcome };
}

function findAssetYtdPct(briefing: BriefingJSON, ...names: string[]): number | null {
  const lowerNames = names.map((n) => n.toLowerCase());
  for (const asset of briefing.btc_vs_everything ?? []) {
    const label = `${asset.name ?? ""} ${asset.ticker ?? ""}`.toLowerCase();
    if (lowerNames.some((n) => label.includes(n))) {
      return typeof asset.change_ytd_pct === "number" ? asset.change_ytd_pct : null;
    }
  }
  return null;
}

// ─── Main task ────────────────────────────────────────────────────────────

/**
 * Resolves predictions whose target_date has passed. Non-fatal — individual
 * resolution failures do not block others. Runs daily at 03:00 UTC (a safe
 * window after the main 01:00 UTC daily-pipeline has completed) so each
 * day's newly-due predictions get resolved promptly.
 *
 * Supported metrics today: BTC price direction (up/down/flat with a ±2% flat
 * band). Other metrics are marked "inconclusive" with a reason note. Over
 * 60+ days the resolved set becomes the feedback layer that empirically
 * calibrates the rubrics: we can correlate claim_text against resolution
 * and see whether Claude's directional calls are predictive.
 */
export const resolvePredictionsTask = schedules.task({
  id: "resolve-predictions",
  cron: "0 3 * * *", // 03:00 UTC daily (2 hours after daily-pipeline runs)
  maxDuration: 600,
  run: async () => {
    const today = new Date().toISOString().split("T")[0];
    logger.info("Prediction resolver started", { today });

    const supabase = createServiceClient();

    // Fetch all predictions whose target_date has passed and are still pending.
    const { data, error } = await supabase
      .from("predictions")
      .select("id, briefing_date, claim_text, direction, metric, target_date")
      .eq("resolution_status", "pending")
      .lte("target_date", today)
      .order("target_date", { ascending: true })
      .limit(200);

    if (error) {
      logger.error("Prediction resolver query failed", { error: error.message });
      throw new Error(`[resolve-predictions] query failed: ${error.message}`);
    }

    const rows = (data ?? []) as PendingPredictionRow[];
    if (rows.length === 0) {
      logger.info("No pending predictions due for resolution");
      return { resolved: 0, correct: 0, incorrect: 0, inconclusive: 0 };
    }

    logger.info("Resolving predictions", { count: rows.length });

    let correct = 0;
    let incorrect = 0;
    let inconclusive = 0;

    for (const row of rows) {
      let result: ResolutionOutcome;
      const metricKey = row.metric.toLowerCase().trim();

      try {
        if (METRIC_GROUPS.btcPrice.has(metricKey)) {
          result = await resolveBtcPricePrediction(row);
        } else if (METRIC_GROUPS.dxy.has(metricKey)) {
          result = await resolveDxyPrediction(supabase, row);
        } else if (METRIC_GROUPS.fundingRate.has(metricKey)) {
          result = await resolveFundingRatePrediction(supabase, row);
        } else if (METRIC_GROUPS.etfFlowZ.has(metricKey)) {
          result = await resolveEtfFlowZScorePrediction(supabase, row);
        } else {
          result = {
            status: "inconclusive",
            outcome: `Metric "${row.metric}" not yet supported by the automated resolver.`,
          };
        }
      } catch (e) {
        result = {
          status: "inconclusive",
          outcome: `Resolver threw: ${(e as Error).message}`,
        };
      }

      const { error: updateError } = await supabase
        .from("predictions")
        .update({
          resolution_status: result.status,
          actual_outcome: result.outcome,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        logger.warn("Failed to update prediction row (non-fatal)", {
          id: row.id,
          error: updateError.message,
        });
        continue;
      }

      if (result.status === "correct") correct++;
      else if (result.status === "incorrect") incorrect++;
      else inconclusive++;

      logger.info("Prediction resolved", {
        id: row.id,
        briefing_date: row.briefing_date,
        target_date: row.target_date,
        metric: row.metric,
        claim_direction: row.direction,
        status: result.status,
      });
    }

    const resolved = correct + incorrect + inconclusive;
    const accuracyPct = correct + incorrect > 0
      ? (correct / (correct + incorrect)) * 100
      : null;

    logger.info("Prediction resolver complete", {
      resolved,
      correct,
      incorrect,
      inconclusive,
      accuracy_pct: accuracyPct != null ? accuracyPct.toFixed(1) : "n/a",
    });

    return { resolved, correct, incorrect, inconclusive };
  },
});
