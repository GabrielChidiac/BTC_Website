import { task, logger } from "@trigger.dev/sdk/v3";
import type { MarketCollectorOutput } from "@/lib/types";
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
import { fetchETFFlows } from "@/trigger/lib/sosovalue";

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
