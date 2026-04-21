import { task, logger } from "@trigger.dev/sdk/v3";
import type { MarketCollectorOutput, ComparativeBaselines } from "@/lib/types";
import {
  fetchBtcPrice,
  fetchGlobalData,
  fetchHistoricalPrices,
  fetchOHLC,
} from "@/trigger/lib/coingecko";
import { fetchMempoolData } from "@/trigger/lib/mempool";
import { calculateIndicators } from "@/trigger/lib/technical-indicators";
import {
  fetchSP500,
  fetchNASDAQ,
  fetchGold,
  fetchDXY,
  fetchETH,
  fetchSOL,
} from "@/trigger/lib/comparison";
import { fetchETFFlows, fetchETFFlowsSeries } from "@/trigger/lib/sosovalue";
import { fetchFundingRate, fetchBinanceFundingRateHistory } from "@/trigger/lib/funding-rate";
import { fetchFearGreedIndex, fetchFearGreedHistory } from "@/trigger/lib/alternativeme";
import { fetchCorrelationMatrix } from "@/trigger/lib/correlation";

// ─── Comparative-baseline helpers ─────────────────────────────────────────

// Annualized realized volatility from a daily closing-price series, using
// std dev of daily log returns. Accepts any length; returns null on <2 points.
function realizedVol(prices: number[]): number | null {
  if (prices.length < 2) return null;
  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  return dailyVol * Math.sqrt(365) * 100;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Percentile rank of `value` inside `series`, expressed as 0-100.
function percentileRank(value: number, series: number[]): number | null {
  if (series.length === 0) return null;
  const below = series.filter((v) => v < value).length;
  const equal = series.filter((v) => v === value).length;
  // Classic "mean" definition: (count_below + 0.5 * count_equal) / total
  return ((below + 0.5 * equal) / series.length) * 100;
}

export const marketCollector = task({
  id: "market-collector",
  run: async ({ date }: { date: string }): Promise<MarketCollectorOutput> => {
    logger.info("Market collector started", { date });

    // ── Step 1: Parallel data fetching ──────────────────────────────────────
    const [
      btcPriceResult,
      globalDataResult,
      historicalResult,
      ohlcResult,
      mempoolResult,
      sp500Result,
      nasdaqResult,
      goldResult,
      dxyResult,
      ethResult,
      solResult,
      etfFlowsResult,
      fundingRateResult,
      fearGreedResult,
      correlationResult,
      etfFlowsSeriesResult,
      fundingHistoryResult,
      fearGreedHistoryResult,
    ] = await Promise.allSettled([
      fetchBtcPrice(),
      fetchGlobalData(),
      fetchHistoricalPrices(365),
      fetchOHLC(30),
      fetchMempoolData(),
      fetchSP500(),
      fetchNASDAQ(),
      fetchGold(),
      fetchDXY(),
      fetchETH(),
      fetchSOL(),
      fetchETFFlows(),
      fetchFundingRate(),
      fetchFearGreedIndex(),
      fetchCorrelationMatrix(),
      fetchETFFlowsSeries(30),
      fetchBinanceFundingRateHistory(90),
      fetchFearGreedHistory(30),
    ]);

    // ── Step 2: Unwrap results ──────────────────────────────────────────────
    const sources: Record<string, boolean> = {};

    function unwrap<T>(
      settled: PromiseSettledResult<{ data: T | null; error: string | null }>,
      label: string
    ): T | null {
      if (settled.status === "rejected") {
        logger.error(`${label} promise rejected`, { reason: settled.reason });
        sources[label] = false;
        return null;
      }
      const result = settled.value;
      if (result.error) {
        logger.error(`${label} returned error`, { error: result.error });
        sources[label] = false;
        return null;
      }
      sources[label] = true;
      return result.data;
    }

    const btcPrice = unwrap(btcPriceResult, "btcPrice");
    const globalData = unwrap(globalDataResult, "globalData");
    const closingPrices = unwrap(historicalResult, "historicalPrices");
    const ohlc = unwrap(ohlcResult, "ohlc30d");
    const mempool = unwrap(mempoolResult, "mempool");
    const sp500 = unwrap(sp500Result, "sp500");
    const nasdaq = unwrap(nasdaqResult, "nasdaq");
    const gold = unwrap(goldResult, "gold");
    const dxy = unwrap(dxyResult, "dxy");
    const eth = unwrap(ethResult, "eth");
    const sol = unwrap(solResult, "sol");
    const etfFlows = unwrap(etfFlowsResult, "etfFlows");
    const fundingRate = unwrap(fundingRateResult, "fundingRate");
    const fearGreed = unwrap(fearGreedResult, "fearGreed");
    const correlationMatrix = unwrap(correlationResult, "correlationMatrix");
    const etfFlowsSeries = unwrap(etfFlowsSeriesResult, "etfFlowsSeries");
    const fundingHistory = unwrap(fundingHistoryResult, "fundingHistory");
    const fearGreedHistory = unwrap(fearGreedHistoryResult, "fearGreedHistory");

    // ── Step 3: Compute technical indicators ────────────────────────────────
    let technical = { rsi_14: 0, sma_50: 0, sma_200: 0, support_level: 0, resistance_level: 0 };
    if (closingPrices && closingPrices.length >= 200) {
      const indicatorResult = calculateIndicators(closingPrices);
      if (!indicatorResult.error) {
        technical = indicatorResult.data!;
        sources["technicalIndicators"] = true;
      } else {
        logger.error("calculateIndicators failed", { error: indicatorResult.error });
        sources["technicalIndicators"] = false;
      }
    } else {
      logger.warn("Skipping technical indicators — insufficient historical data", {
        dataPoints: closingPrices?.length ?? 0,
      });
      sources["technicalIndicators"] = false;
    }

    // Override support/resistance with true 30-day high/low from OHLC candles
    if (ohlc && ohlc.highs.length > 0 && ohlc.lows.length > 0) {
      technical.resistance_level = Math.round(Math.max(...ohlc.highs) * 100) / 100;
      technical.support_level = Math.round(Math.min(...ohlc.lows) * 100) / 100;
      sources["ohlc30d"] = true;
      logger.info("Support/resistance from OHLC", {
        support: technical.support_level,
        resistance: technical.resistance_level,
        candles: ohlc.highs.length,
      });
    } else {
      logger.warn("OHLC data unavailable — support/resistance from closing prices");
    }

    // ── Step 4: Compute BTC YTD change ──────────────────────────────────────
    let btcYtdPct: number | null = null;
    let btc1yPct: number | null = btcPrice?.change_1y_pct ?? null;

    if (closingPrices && closingPrices.length > 0) {
      const now = new Date();
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)
      );
      // closingPrices is 365 days of data, most recent last
      const ytdIndex = closingPrices.length - dayOfYear;
      if (ytdIndex >= 0 && ytdIndex < closingPrices.length) {
        const janPrice = closingPrices[ytdIndex];
        const currentPrice = closingPrices[closingPrices.length - 1];
        btcYtdPct = ((currentPrice - janPrice) / janPrice) * 100;
      }
    }

    // ── Step 4.5: Compute comparative baselines ──────────────────────────
    // These give Claude quantitative anchors ("funding is in the 82nd
    // percentile of 30 days", "ETF flows 2.1σ above mean") instead of raw
    // numbers, so prose can't vague-handwave. Every field is null-safe;
    // prompts render only what's non-null.
    const comparative: ComparativeBaselines = {
      realized_vol_30d_pct: null,
      realized_vol_90d_pct: null,
      price_vs_30d_avg_pct: null,
      price_30d_high: null,
      price_30d_low: null,
      funding_rate_30d_avg_pct: null,
      funding_rate_30d_percentile: null,
      fear_greed_30d_avg: null,
      fear_greed_30d_change: null,
      etf_flows_30d_avg_usd: null,
      etf_flows_30d_z_score: null,
    };

    if (closingPrices && closingPrices.length >= 30) {
      const last30 = closingPrices.slice(-30);
      const last90 = closingPrices.slice(-90);
      comparative.realized_vol_30d_pct = realizedVol(last30);
      if (last90.length >= 30) {
        comparative.realized_vol_90d_pct = realizedVol(last90);
      }
      const avg30 = mean(last30);
      const currentPrice = closingPrices[closingPrices.length - 1];
      comparative.price_vs_30d_avg_pct = ((currentPrice - avg30) / avg30) * 100;
      comparative.price_30d_high = Math.max(...last30);
      comparative.price_30d_low = Math.min(...last30);
    }

    if (fundingHistory && fundingHistory.length > 0 && fundingRate?.annualized_rate_pct != null) {
      comparative.funding_rate_30d_avg_pct = mean(fundingHistory);
      comparative.funding_rate_30d_percentile = percentileRank(
        fundingRate.annualized_rate_pct,
        fundingHistory,
      );
    }

    if (fearGreedHistory && fearGreedHistory.length > 0 && fearGreed?.value != null) {
      comparative.fear_greed_30d_avg = mean(fearGreedHistory);
      comparative.fear_greed_30d_change = fearGreed.value - comparative.fear_greed_30d_avg;
    }

    if (etfFlowsSeries && etfFlowsSeries.length >= 10 && etfFlows?.daily_net_flow_usd != null) {
      const avg = mean(etfFlowsSeries);
      const sd = stdDev(etfFlowsSeries);
      comparative.etf_flows_30d_avg_usd = avg;
      comparative.etf_flows_30d_z_score = sd > 0
        ? (etfFlows.daily_net_flow_usd - avg) / sd
        : null;
    }

    // ── Step 5: Assemble output ─────────────────────────────────────────────
    const output: MarketCollectorOutput = {
      price: {
        usd: btcPrice?.usd ?? 0,
        change_24h_pct: btcPrice?.change_24h_pct ?? 0,
        change_7d_pct: btcPrice?.change_7d_pct ?? 0,
        market_cap_usd: btcPrice?.market_cap_usd ?? 0,
        volume_24h_usd: btcPrice?.volume_24h_usd ?? 0,
      },
      dominance_pct: globalData?.dominance_pct ?? 0,
      technical,
      network: {
        hashrate_eh_s: mempool?.hashrate_eh_s ?? 0,
        difficulty: mempool?.difficulty ?? 0,
        block_height: mempool?.block_height ?? 0,
        mempool_tx_count: mempool?.mempool_tx_count ?? 0,
        mempool_size_mb: mempool?.mempool_size_mb ?? 0,
        fee_fast_sat_vb: mempool?.fee_fast_sat_vb ?? 0,
        fee_medium_sat_vb: mempool?.fee_medium_sat_vb ?? 0,
        fee_slow_sat_vb: mempool?.fee_slow_sat_vb ?? 0,
      },
      comparisons: {
        sp500_change_24h_pct: sp500?.change_24h_pct ?? null,
        sp500_change_ytd_pct: sp500?.change_ytd_pct ?? null,
        sp500_change_1y_pct: sp500?.change_1y_pct ?? null,
        nasdaq_change_24h_pct: nasdaq?.change_24h_pct ?? null,
        nasdaq_change_ytd_pct: nasdaq?.change_ytd_pct ?? null,
        nasdaq_change_1y_pct: nasdaq?.change_1y_pct ?? null,
        gold_change_24h_pct: gold?.change_24h_pct ?? null,
        gold_change_ytd_pct: gold?.change_ytd_pct ?? null,
        gold_change_1y_pct: gold?.change_1y_pct ?? null,
        dxy_change_24h_pct: dxy?.change_24h_pct ?? null,
        dxy_change_ytd_pct: dxy?.change_ytd_pct ?? null,
        dxy_change_1y_pct: dxy?.change_1y_pct ?? null,
        eth_change_24h_pct: eth?.change_24h_pct ?? null,
        eth_change_ytd_pct: eth?.change_ytd_pct ?? null,
        eth_change_1y_pct: eth?.change_1y_pct ?? null,
        sol_change_24h_pct: sol?.change_24h_pct ?? null,
        sol_change_ytd_pct: sol?.change_ytd_pct ?? null,
        sol_change_1y_pct: sol?.change_1y_pct ?? null,
      },
      ath_usd: btcPrice?.ath_usd ?? null,
      ath_date: btcPrice?.ath_date ?? null,
      btc_change_ytd_pct: btcYtdPct,
      btc_change_1y_pct: btc1yPct,
      etf_flows: etfFlows ?? null,
      funding_rate: fundingRate ?? null,
      fear_greed: fearGreed ?? null,
      correlation_matrix: correlationMatrix ?? null,
      comparative,
    };

    // ── Step 6: Log summary and return ──────────────────────────────────────
    const available = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
    const failed = Object.entries(sources).filter(([, v]) => !v).map(([k]) => k);

    logger.info("Market collector completed", {
      date,
      available,
      failed,
      availableCount: available.length,
      failedCount: failed.length,
    });

    return output;
  },
});
