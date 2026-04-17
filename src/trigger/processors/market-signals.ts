import { logger } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  BriefingJSON,
  MarketSignal,
  MarketSignalType,
  DailyBriefingRow,
} from "@/lib/types";

// ─── Tunables ─────────────────────────────────────────────────────────────
// Editorial thresholds. Tuned to fire rarely: a quiet day with no callouts
// is the expected state. Over-firing erodes the time-respect promise.

const HISTORY_DAYS = 30;            // rolling window pulled from Supabase
const FUNDING_PERCENTILE_DAYS = 90; // fallback — we only have up to 30
const MAX_SIGNALS = 2;              // hard cap shown per brief

// Correlation regime
const SP500_REGIME_THRESHOLD = 0.5;   // crossing this = risk-asset/safe-haven flip
const GOLD_REGIME_THRESHOLD = 0.3;
const CORR_MIN_DELTA = 0.15;          // noise floor — smaller moves don't fire
const CORR_COOLDOWN_DAYS = 14;

// Funding extreme (annualized %, e.g. 32.4 means 32.4% annualized)
const FUNDING_EXTREME_HIGH = 30;      // crowded longs
const FUNDING_EXTREME_LOW = -15;      // crowded shorts (rarer, so tighter)
const FUNDING_TOP_DECILE_FLOOR = 20;  // minimum annualized % for "top decile" signal
const FUNDING_COOLDOWN_DAYS = 3;

// Sentiment (Fear & Greed, 0-100)
const FG_EXTREME_FEAR = 25;
const FG_EXTREME_GREED = 75;
const FG_SEVEN_DAY_DELTA = 20;
const SENTIMENT_COOLDOWN_DAYS = 2;

// ─── History types ────────────────────────────────────────────────────────

interface HistoryRow {
  date: string;
  fundingAnnualizedPct: number | null;
  fearGreedValue: number | null;
  fearGreedLabel: string | null;
  spCorr: number | null;
  goldCorr: number | null;
  signals: MarketSignal[];
}

// ─── Public entrypoint ────────────────────────────────────────────────────

/**
 * Compute 0-2 editorial callouts from today's market data + recent history.
 *
 * Silent by design: thresholds + per-signal-type cooldowns keep the daily
 * brief uncrowded. Callers should treat empty result as normal.
 *
 * Never throws — returns [] on any error so the pipeline ships without
 * signals rather than failing the whole brief.
 */
export async function computeMarketSignals(
  today: Pick<BriefingJSON, "date" | "funding_rate" | "fear_greed" | "correlation_matrix">,
): Promise<MarketSignal[]> {
  try {
    const history = await loadHistory(today.date);

    const correlation = detectCorrelationRegime(today, history);
    const funding = detectFundingExtreme(today, history);
    const sentiment = detectSentimentShift(today, history);

    // Priority order: correlation > funding > sentiment.
    // Correlation regime shifts carry the most institutional weight; sentiment
    // is the most legible to a non-crypto-native reader.
    const all: MarketSignal[] = [];
    if (correlation) all.push(correlation);
    if (funding) all.push(funding);
    if (sentiment) all.push(sentiment);

    const capped = all.slice(0, MAX_SIGNALS);
    logger.info("Market signals computed", {
      emitted: capped.length,
      types: capped.map((s) => s.type),
    });
    return capped;
  } catch (err) {
    logger.warn("Market signals failed — returning empty", {
      error: (err as Error).message,
    });
    return [];
  }
}

// ─── History loader ───────────────────────────────────────────────────────

async function loadHistory(todayDate: string): Promise<HistoryRow[]> {
  const supabase = createServiceClient();
  const cutoff = new Date(todayDate + "T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("daily_briefings")
    .select("date, content")
    .gte("date", cutoffStr)
    .lt("date", todayDate)
    .order("date", { ascending: false });

  if (error) {
    logger.warn("Signals history query failed", { error: error.message });
    return [];
  }

  const rows = (data ?? []) as Pick<DailyBriefingRow, "date" | "content">[];
  return rows.map((row) => {
    const c = row.content;
    return {
      date: row.date,
      fundingAnnualizedPct: c?.funding_rate?.annualized_rate_pct ?? null,
      fearGreedValue: c?.fear_greed?.value ?? null,
      fearGreedLabel: c?.fear_greed?.label ?? null,
      spCorr: c?.correlation_matrix?.btc_sp500_90d ?? null,
      goldCorr: c?.correlation_matrix?.btc_gold_90d ?? null,
      signals: Array.isArray(c?.market_signals) ? (c?.market_signals ?? []) : [],
    };
  });
}

// ─── Detector: correlation regime shift ───────────────────────────────────

function detectCorrelationRegime(
  today: Pick<BriefingJSON, "correlation_matrix">,
  history: HistoryRow[],
): MarketSignal | null {
  if (onCooldown("correlation_regime", history, CORR_COOLDOWN_DAYS)) return null;

  const corr = today.correlation_matrix;
  if (!corr) return null;

  // Find a reference point from 5-9 days ago (weekend gaps tolerated).
  const reference = findWindow(history, 5, 9);
  if (!reference) return null;

  const todaySp = corr.btc_sp500_90d;
  const todayGold = corr.btc_gold_90d;
  const refSp = reference.spCorr;
  const refGold = reference.goldCorr;

  // BTC-S&P flip (risk-asset regime)
  if (
    typeof todaySp === "number" &&
    typeof refSp === "number" &&
    crossedThreshold(refSp, todaySp, SP500_REGIME_THRESHOLD) &&
    Math.abs(todaySp - refSp) >= CORR_MIN_DELTA
  ) {
    const toRiskAsset = todaySp >= SP500_REGIME_THRESHOLD;
    return {
      type: "correlation_regime",
      severity: "high",
      headline: toRiskAsset
        ? "BTC now trading as risk asset"
        : "BTC decoupling from equities",
      detail: toRiskAsset
        ? `90-day S&P correlation at ${fmtCorr(todaySp)}, up from ${fmtCorr(refSp)} a week ago. Less safe-haven hedge, more leveraged equity beta.`
        : `90-day S&P correlation at ${fmtCorr(todaySp)}, down from ${fmtCorr(refSp)} a week ago. BTC is moving on its own fundamentals again.`,
    };
  }

  // BTC-Gold flip (safe-haven regime)
  if (
    typeof todayGold === "number" &&
    typeof refGold === "number" &&
    crossedThreshold(refGold, todayGold, GOLD_REGIME_THRESHOLD) &&
    Math.abs(todayGold - refGold) >= CORR_MIN_DELTA
  ) {
    const toSafeHaven = todayGold >= GOLD_REGIME_THRESHOLD;
    return {
      type: "correlation_regime",
      severity: "high",
      headline: toSafeHaven
        ? "BTC tracking gold again"
        : "BTC-gold link breaking down",
      detail: toSafeHaven
        ? `90-day gold correlation at ${fmtCorr(todayGold)}, up from ${fmtCorr(refGold)} a week ago. Safe-haven behavior returning.`
        : `90-day gold correlation at ${fmtCorr(todayGold)}, down from ${fmtCorr(refGold)} a week ago. Safe-haven thesis weakening for now.`,
    };
  }

  return null;
}

// ─── Detector: funding rate extreme ───────────────────────────────────────

function detectFundingExtreme(
  today: Pick<BriefingJSON, "funding_rate">,
  history: HistoryRow[],
): MarketSignal | null {
  if (onCooldown("funding_extreme", history, FUNDING_COOLDOWN_DAYS)) return null;

  const fr = today.funding_rate;
  if (!fr || typeof fr.annualized_rate_pct !== "number") return null;
  const annualized = fr.annualized_rate_pct;

  // Absolute extreme check first (fires even with no history).
  if (annualized >= FUNDING_EXTREME_HIGH) {
    return {
      type: "funding_extreme",
      severity: "high",
      headline: "Perp funding crowded long",
      detail: `OI-weighted funding at ${annualized.toFixed(1)}% annualized. Crowded positioning on the long side has historically preceded sharp unwinds.`,
    };
  }
  if (annualized <= FUNDING_EXTREME_LOW) {
    return {
      type: "funding_extreme",
      severity: "high",
      headline: "Perp funding crowded short",
      detail: `OI-weighted funding at ${annualized.toFixed(1)}% annualized. Crowded shorts are a squeeze setup when spot catches a bid.`,
    };
  }

  // Percentile check — requires enough history.
  const past = history
    .map((h) => h.fundingAnnualizedPct)
    .filter((v): v is number => typeof v === "number")
    .slice(0, FUNDING_PERCENTILE_DAYS);
  if (past.length >= 14) {
    const sortedAbs = [...past.map((v) => Math.abs(v))].sort((a, b) => a - b);
    const p90 = percentile(sortedAbs, 0.9);
    if (Math.abs(annualized) >= Math.max(p90, FUNDING_TOP_DECILE_FLOOR)) {
      const direction = annualized > 0 ? "long" : "short";
      return {
        type: "funding_extreme",
        severity: "medium",
        headline: `Funding in top decile ${direction} side`,
        detail: `${annualized.toFixed(1)}% annualized is the top 10% of readings over the last ${past.length} days. Leverage is crowded; keep an eye on liquidation maps.`,
      };
    }
  }

  // Sign flip after a streak.
  const streakLen = sameSignStreak(past, Math.sign(annualized));
  if (streakLen >= 5 && past.length > 0 && Math.sign(past[0]) !== Math.sign(annualized)) {
    const direction = annualized > 0 ? "positive" : "negative";
    return {
      type: "funding_extreme",
      severity: "medium",
      headline: `Funding flipped ${direction}`,
      detail: `Funding turned ${direction} after ${streakLen} days on the other side. Positioning is resetting; trend-continuation trades lose their edge here.`,
    };
  }

  return null;
}

// ─── Detector: sentiment shift ────────────────────────────────────────────

function detectSentimentShift(
  today: Pick<BriefingJSON, "fear_greed">,
  history: HistoryRow[],
): MarketSignal | null {
  if (onCooldown("sentiment_shift", history, SENTIMENT_COOLDOWN_DAYS)) return null;

  const fg = today.fear_greed;
  if (!fg || typeof fg.value !== "number") return null;
  const value = fg.value;

  // Extreme zone entry (yesterday was outside extreme, today is inside).
  const yesterday = history[0]?.fearGreedValue ?? null;
  if (typeof yesterday === "number") {
    const wasExtreme = yesterday < FG_EXTREME_FEAR || yesterday > FG_EXTREME_GREED;
    const isExtreme = value < FG_EXTREME_FEAR || value > FG_EXTREME_GREED;
    if (!wasExtreme && isExtreme) {
      const zone = value < FG_EXTREME_FEAR ? "Extreme Fear" : "Extreme Greed";
      return {
        type: "sentiment_shift",
        severity: "high",
        headline: `Sentiment flipped to ${zone}`,
        detail: value < FG_EXTREME_FEAR
          ? `Fear & Greed at ${value} out of 100, down from ${yesterday} yesterday. Historically a buying window for long-term holders, not a selling one.`
          : `Fear & Greed at ${value} out of 100, up from ${yesterday} yesterday. Historically a time to stay disciplined and watch position sizing.`,
      };
    }
  }

  // 7-day delta.
  const reference = findWindow(history, 5, 9);
  if (reference && typeof reference.fearGreedValue === "number") {
    const delta = value - reference.fearGreedValue;
    if (Math.abs(delta) >= FG_SEVEN_DAY_DELTA) {
      const direction = delta < 0 ? "fear" : "greed";
      return {
        type: "sentiment_shift",
        severity: "medium",
        headline: `Sentiment shifted hard toward ${direction}`,
        detail: `Fear & Greed at ${value} vs ${reference.fearGreedValue} a week ago, a ${Math.abs(delta)}-point move. Sustained shifts of this size reshape near-term risk appetite.`,
      };
    }
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function onCooldown(
  type: MarketSignalType,
  history: HistoryRow[],
  days: number,
): boolean {
  const recent = history.slice(0, days);
  return recent.some((row) => row.signals.some((s) => s.type === type));
}

function findWindow(
  history: HistoryRow[],
  minDaysAgo: number,
  maxDaysAgo: number,
): HistoryRow | null {
  // history is ordered newest-first; index 0 is yesterday, index 1 is 2 days ago, etc.
  const slice = history.slice(minDaysAgo - 1, maxDaysAgo);
  return slice.find(Boolean) ?? null;
}

function crossedThreshold(prev: number, curr: number, threshold: number): boolean {
  return (
    (prev < threshold && curr >= threshold) ||
    (prev > threshold && curr <= threshold) ||
    (prev < -threshold && curr >= -threshold) ||
    (prev > -threshold && curr <= -threshold)
  );
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

function sameSignStreak(history: number[], sign: number): number {
  let n = 0;
  for (const v of history) {
    if (Math.sign(v) === sign) n++;
    else break;
  }
  return n;
}

function fmtCorr(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}
