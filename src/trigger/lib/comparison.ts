import type { Result } from "@/lib/types";
import YahooFinance from "yahoo-finance2";
import { withTimeout } from "./fetch-timeout";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

interface AssetData {
  change_24h_pct: number;
  change_ytd_pct: number | null;
  change_1y_pct: number | null;
}

/**
 * Generic Yahoo Finance fetcher — works for any ticker.
 * Returns 24h change from quote(), YTD and 1Y from chart().
 */
async function fetchYahooAsset(
  ticker: string,
  label: string
): Promise<Result<AssetData>> {
  try {
    const quote = (await withTimeout(yahooFinance.quote(ticker), 30_000, `yahoo-${label}`)) as Record<string, unknown>;
    const change = quote.regularMarketChangePercent as number | undefined;

    if (change === undefined || change === null) {
      return { data: null, error: `[comparison] ${label} change percent unavailable` };
    }

    const currentPrice = quote.regularMarketPrice as number | undefined;
    let ytdPct: number | null = null;
    let oneYearPct: number | null = null;

    if (currentPrice) {
      try {
        const now = new Date();
        const janFirst = new Date(now.getFullYear(), 0, 1);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const historical = (await withTimeout(yahooFinance.chart(ticker, {
          period1: oneYearAgo,
          period2: now,
          interval: "1mo",
        }), 30_000, `yahoo-chart-${label}`)) as { quotes: { close: number; date: Date }[] };

        if (historical.quotes && historical.quotes.length > 0) {
          const firstClose = historical.quotes[0].close;
          oneYearPct = ((currentPrice - firstClose) / firstClose) * 100;

          // Find the quote closest to Jan 1 for YTD
          const janQuote = historical.quotes.find(
            (q: { date: Date }) => new Date(q.date) >= janFirst
          );
          if (janQuote) {
            ytdPct = ((currentPrice - janQuote.close) / janQuote.close) * 100;
          }
        }
      } catch {
        // YTD/1Y data is best-effort
      }
    }

    return {
      data: {
        change_24h_pct: change,
        change_ytd_pct: ytdPct,
        change_1y_pct: oneYearPct,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: `[comparison] fetch${label}: ${(e as Error).message}`,
    };
  }
}

// ── Individual asset fetchers ─────────────────────────────────────────────

export function fetchSP500(): Promise<Result<AssetData>> {
  return fetchYahooAsset("^GSPC", "SP500");
}

export function fetchNASDAQ(): Promise<Result<AssetData>> {
  return fetchYahooAsset("^NDX", "NASDAQ");
}

export function fetchGold(): Promise<Result<AssetData>> {
  return fetchYahooAsset("GC=F", "Gold");
}

export function fetchDXY(): Promise<Result<AssetData>> {
  return fetchYahooAsset("DX-Y.NYB", "DXY");
}

export function fetchETH(): Promise<Result<AssetData>> {
  return fetchYahooAsset("ETH-USD", "ETH");
}

export function fetchSOL(): Promise<Result<AssetData>> {
  return fetchYahooAsset("SOL-USD", "SOL");
}
