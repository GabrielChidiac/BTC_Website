import type { Result, FundingRate, ExchangeFundingRate } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";
import { logger } from "@trigger.dev/sdk/v3";

const TIMEOUT = 15_000;

// ─── Binance ─────────────────────────────────────────────────────────────

async function fetchBinanceFunding(): Promise<ExchangeFundingRate | null> {
  try {
    const [premiumRes, oiRes] = await Promise.all([
      fetchWithTimeout(
        "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
        undefined,
        TIMEOUT,
      ),
      fetchWithTimeout(
        "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT",
        undefined,
        TIMEOUT,
      ),
    ]);

    if (!premiumRes.ok || !oiRes.ok) return null;

    const premium = await premiumRes.json();
    const oi = await oiRes.json();

    const rate = parseFloat(premium.lastFundingRate);
    const markPrice = parseFloat(premium.markPrice);
    const openInterestBtc = parseFloat(oi.openInterest);

    if (isNaN(rate) || isNaN(markPrice) || isNaN(openInterestBtc)) return null;

    return {
      exchange: "binance",
      funding_rate: rate,
      open_interest_usd: openInterestBtc * markPrice,
    };
  } catch (e) {
    logger.warn("Binance funding fetch failed", { error: (e as Error).message });
    return null;
  }
}

// ─── Bybit ───────────────────────────────────────────────────────────────

async function fetchBybitFunding(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
      undefined,
      TIMEOUT,
    );

    if (!res.ok) return null;

    const json = await res.json();
    const ticker = json.result?.list?.[0];
    if (!ticker) return null;

    const rate = parseFloat(ticker.fundingRate);
    const oiBtc = parseFloat(ticker.openInterest);
    const lastPrice = parseFloat(ticker.lastPrice);

    if (isNaN(rate) || isNaN(oiBtc) || isNaN(lastPrice)) return null;

    return {
      exchange: "bybit",
      funding_rate: rate,
      open_interest_usd: oiBtc * lastPrice,
    };
  } catch (e) {
    logger.warn("Bybit funding fetch failed", { error: (e as Error).message });
    return null;
  }
}

// ─── OKX ─────────────────────────────────────────────────────────────────

async function fetchOkxFunding(): Promise<ExchangeFundingRate | null> {
  try {
    const [rateRes, oiRes, markRes] = await Promise.all([
      fetchWithTimeout(
        "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
        undefined,
        TIMEOUT,
      ),
      fetchWithTimeout(
        "https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP",
        undefined,
        TIMEOUT,
      ),
      fetchWithTimeout(
        "https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=BTC-USDT-SWAP",
        undefined,
        TIMEOUT,
      ),
    ]);

    if (!rateRes.ok || !oiRes.ok || !markRes.ok) return null;

    const rateJson = await rateRes.json();
    const oiJson = await oiRes.json();
    const markJson = await markRes.json();

    const fundingRate = parseFloat(rateJson.data?.[0]?.fundingRate);
    const oiBtc = parseFloat(oiJson.data?.[0]?.oiCcy);
    const markPrice = parseFloat(markJson.data?.[0]?.markPx);

    if (isNaN(fundingRate) || isNaN(oiBtc) || isNaN(markPrice)) return null;

    return {
      exchange: "okx",
      funding_rate: fundingRate,
      open_interest_usd: oiBtc * markPrice,
    };
  } catch (e) {
    logger.warn("OKX funding fetch failed", { error: (e as Error).message });
    return null;
  }
}

// ─── Historical series (used for comparative baselines) ─────────────────
// Binance's /fapi/v1/fundingRate endpoint returns funding settlements. With
// 3 settlements per day (every 8h), limit=90 covers ~30 days. Returns
// annualized % values for consistency with FundingRate.annualized_rate_pct.

export async function fetchBinanceFundingRateHistory(
  snapshots: number = 90
): Promise<Result<number[]>> {
  try {
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=${snapshots}`,
      undefined,
      TIMEOUT,
    );

    if (!res.ok) {
      return {
        data: null,
        error: `[funding-rate-history] Binance returned status ${res.status}`,
      };
    }

    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) {
      return { data: null, error: "[funding-rate-history] Empty response" };
    }

    const annualized: number[] = [];
    for (const entry of json) {
      const rate = parseFloat(entry.fundingRate);
      if (!isNaN(rate)) {
        // Same conversion as live FundingRate: per-settlement rate × 3 × 365 × 100
        annualized.push(rate * 3 * 365 * 100);
      }
    }

    if (annualized.length === 0) {
      return { data: null, error: "[funding-rate-history] No valid rates parsed" };
    }

    return { data: annualized, error: null };
  } catch (e) {
    return { data: null, error: `[funding-rate-history] ${(e as Error).message}` };
  }
}

// ─── Aggregator ──────────────────────────────────────────────────────────

export async function fetchFundingRate(): Promise<Result<FundingRate>> {
  try {
    const results = await Promise.allSettled([
      fetchBinanceFunding(),
      fetchBybitFunding(),
      fetchOkxFunding(),
    ]);

    const exchanges: ExchangeFundingRate[] = results
      .filter(
        (r): r is PromiseFulfilledResult<ExchangeFundingRate | null> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value)
      .filter((v): v is ExchangeFundingRate => v !== null);

    if (exchanges.length === 0) {
      return { data: null, error: "[funding-rate] All exchange fetches failed" };
    }

    const totalOI = exchanges.reduce((sum, e) => sum + e.open_interest_usd, 0);
    const weightedRate =
      exchanges.reduce((sum, e) => sum + e.funding_rate * e.open_interest_usd, 0) / totalOI;

    // Funding settles every 8h (3x/day) on all three exchanges
    const annualizedPct = weightedRate * 3 * 365 * 100;

    logger.info("Funding rate computed", {
      exchanges: exchanges.map((e) => e.exchange),
      weightedRateBps: (weightedRate * 10_000).toFixed(2),
      totalOIBillions: (totalOI / 1e9).toFixed(2),
    });

    return {
      data: {
        weighted_rate: weightedRate,
        annualized_rate_pct: Math.round(annualizedPct * 100) / 100,
        total_open_interest_usd: Math.round(totalOI),
        exchanges,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[funding-rate] ${(e as Error).message}` };
  }
}
