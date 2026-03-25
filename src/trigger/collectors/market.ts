import { task, logger } from "@trigger.dev/sdk/v3";
import type { MarketCollectorOutput } from "@/lib/types";
import {
  fetchBtcPrice,
  fetchGlobalData,
  fetchHistoricalPrices,
  fetchGoldPrice,
} from "@/trigger/lib/coingecko";
import { fetchMempoolData } from "@/trigger/lib/mempool";
import { calculateIndicators } from "@/trigger/lib/technical-indicators";
import { fetchSP500, fetchDXY } from "@/trigger/lib/comparison";

export const marketCollector = task({
  id: "market-collector",
  run: async ({ date }: { date: string }): Promise<MarketCollectorOutput> => {
    logger.info("Market collector started", { date });

    // ── Step 1: Parallel data fetching ──────────────────────────────────────
    const [
      btcPriceResult,
      globalDataResult,
      historicalResult,
      goldResult,
      mempoolResult,
      sp500Result,
      dxyResult,
    ] = await Promise.allSettled([
      fetchBtcPrice(),
      fetchGlobalData(),
      fetchHistoricalPrices(365),
      fetchGoldPrice(),
      fetchMempoolData(),
      fetchSP500(),
      fetchDXY(),
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
    const gold = unwrap(goldResult, "gold");
    const mempool = unwrap(mempoolResult, "mempool");
    const sp500 = unwrap(sp500Result, "sp500");
    const dxy = unwrap(dxyResult, "dxy");

    // ── Step 3: Compute technical indicators ────────────────────────────────
    let technical = { rsi_14: 0, sma_50: 0, sma_200: 0 };
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
        gold_price_usd: gold?.gold_price_usd ?? null,
        gold_change_ytd_pct: null, // Gold YTD not available from CoinGecko simple endpoint
        gold_change_1y_pct: null,
        dxy_change_24h_pct: dxy?.change_24h_pct ?? null,
        dxy_change_ytd_pct: null, // Alpha Vantage free tier only returns daily change
        dxy_change_1y_pct: null,
      },
      btc_change_ytd_pct: btcYtdPct,
      btc_change_1y_pct: btc1yPct,
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
