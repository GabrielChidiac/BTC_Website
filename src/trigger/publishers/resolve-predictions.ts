import { schedules, logger } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchBtcCloseAtDate } from "@/trigger/lib/coingecko";

// ─── Resolution constants ─────────────────────────────────────────────────

// Flat band: within ±2% counts as "flat". Below this threshold in either
// direction, we call it up or down. Chosen to match how a holder actually
// experiences "did the market move?" over a multi-week horizon.
const FLAT_BAND_PCT = 2;

// Only resolve predictions for metrics we can verify automatically. Others
// are marked "inconclusive" with a reason and can be revisited later.
const SUPPORTED_METRICS = new Set(["btc_price", "btc", "bitcoin_price"]);

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

  let actualDirection: "up" | "down" | "flat";
  if (Math.abs(pctMove) < FLAT_BAND_PCT) {
    actualDirection = "flat";
  } else if (pctMove > 0) {
    actualDirection = "up";
  } else {
    actualDirection = "down";
  }

  const correct = actualDirection === row.direction;
  const outcome = `Claim: ${row.direction}. Actual: ${actualDirection} (${pctMove >= 0 ? "+" : ""}${pctMove.toFixed(2)}% from $${Math.round(entry).toLocaleString()} on ${row.briefing_date} to $${Math.round(exit).toLocaleString()} on ${row.target_date}).`;

  return { status: correct ? "correct" : "incorrect", outcome };
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

      if (SUPPORTED_METRICS.has(metricKey)) {
        try {
          result = await resolveBtcPricePrediction(row);
        } catch (e) {
          result = {
            status: "inconclusive",
            outcome: `Resolver threw: ${(e as Error).message}`,
          };
        }
      } else {
        result = {
          status: "inconclusive",
          outcome: `Metric "${row.metric}" not yet supported by the automated resolver.`,
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
