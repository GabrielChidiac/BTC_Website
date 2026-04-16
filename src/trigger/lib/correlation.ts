import type { Result, CorrelationMatrix } from "@/lib/types";
import YahooFinance from "yahoo-finance2";
import { withTimeout } from "./fetch-timeout";
import { logger } from "@trigger.dev/sdk/v3";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const MIN_DATA_POINTS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────

interface DailyClose {
  date: string; // YYYY-MM-DD
  close: number;
}

async function fetchDailyCloses(
  ticker: string,
  label: string,
  days: number,
): Promise<DailyClose[]> {
  const period1 = new Date();
  period1.setDate(period1.getDate() - days - 5); // buffer for weekends/holidays

  const result = (await withTimeout(
    yahooFinance.chart(ticker, { period1, interval: "1d" }),
    30_000,
    `yahoo-corr-${label}`,
  )) as { quotes: { date: Date; close: number | null }[] };

  return result.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({
      date: new Date(q.date).toISOString().slice(0, 10),
      close: q.close!,
    }));
}

function computeLogReturns(
  closes: DailyClose[],
): { date: string; ret: number }[] {
  const returns: { date: string; ret: number }[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push({
      date: closes[i].date,
      ret: Math.log(closes[i].close / closes[i - 1].close),
    });
  }
  return returns;
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns null if fewer than MIN_DATA_POINTS or zero variance.
 */
function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < MIN_DATA_POINTS) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );
  if (denom === 0) return null; // constant series

  const r = (n * sumXY - sumX * sumY) / denom;
  // Clamp to [-1, 1] to guard against floating-point drift
  return Math.max(-1, Math.min(1, r));
}

/**
 * Align two return series by date (inner join) and return paired arrays.
 */
function alignReturns(
  a: { date: string; ret: number }[],
  b: { date: string; ret: number }[],
): { x: number[]; y: number[] } {
  const bMap = new Map(b.map((r) => [r.date, r.ret]));
  const x: number[] = [];
  const y: number[] = [];
  for (const entry of a) {
    const bVal = bMap.get(entry.date);
    if (bVal !== undefined) {
      x.push(entry.ret);
      y.push(bVal);
    }
  }
  return { x, y };
}

// ─── Exported fetcher ────────────────────────────────────────────────────

export async function fetchCorrelationMatrix(): Promise<
  Result<CorrelationMatrix>
> {
  try {
    const [btcResult, goldResult, spResult] = await Promise.allSettled([
      fetchDailyCloses("BTC-USD", "BTC", 95),
      fetchDailyCloses("GC=F", "Gold", 95),
      fetchDailyCloses("^GSPC", "SP500", 95),
    ]);

    // BTC is required for any correlation
    if (btcResult.status === "rejected" || btcResult.value.length === 0) {
      return {
        data: null,
        error: "[correlation] BTC daily closes unavailable",
      };
    }

    const btcCloses = btcResult.value;
    const btcReturns = computeLogReturns(btcCloses);

    // Gold correlation
    let btcGold90d: number | null = null;
    let dataPointsGold = 0;
    if (goldResult.status === "fulfilled" && goldResult.value.length > 0) {
      const goldReturns = computeLogReturns(goldResult.value);
      const aligned = alignReturns(btcReturns, goldReturns);
      dataPointsGold = aligned.x.length;
      btcGold90d = pearsonCorrelation(aligned.x, aligned.y);
    }

    // S&P 500 correlation
    let btcSp50090d: number | null = null;
    let dataPointsSp500 = 0;
    if (spResult.status === "fulfilled" && spResult.value.length > 0) {
      const spReturns = computeLogReturns(spResult.value);
      const aligned = alignReturns(btcReturns, spReturns);
      dataPointsSp500 = aligned.x.length;
      btcSp50090d = pearsonCorrelation(aligned.x, aligned.y);
    }

    // At least one correlation must be computable
    if (btcGold90d === null && btcSp50090d === null) {
      return {
        data: null,
        error: "[correlation] Insufficient data for any correlation pair",
      };
    }

    // Round to 2 decimal places
    const round2 = (v: number | null) =>
      v !== null ? Math.round(v * 100) / 100 : null;

    const periodStart = btcCloses[0].date;
    const periodEnd = btcCloses[btcCloses.length - 1].date;

    logger.info("Correlation matrix computed", {
      btcGold90d: round2(btcGold90d),
      btcSp50090d: round2(btcSp50090d),
      dataPointsGold,
      dataPointsSp500,
      period: `${periodStart} to ${periodEnd}`,
    });

    return {
      data: {
        btc_gold_90d: round2(btcGold90d),
        btc_sp500_90d: round2(btcSp50090d),
        data_points_gold: dataPointsGold,
        data_points_sp500: dataPointsSp500,
        period_start: periodStart,
        period_end: periodEnd,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[correlation] ${(e as Error).message}` };
  }
}
