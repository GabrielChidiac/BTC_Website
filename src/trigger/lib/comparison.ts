import { ALPHA_VANTAGE_BASE } from "@/lib/constants";
import type { Result } from "@/lib/types";
import yahooFinance from "yahoo-finance2";

interface SP500Data {
  change_24h_pct: number;
  change_ytd_pct: number | null;
  change_1y_pct: number | null;
}

export async function fetchSP500(): Promise<Result<SP500Data>> {
  try {
    const quote = await yahooFinance.quote("^GSPC") as Record<string, unknown>;
    const change = quote.regularMarketChangePercent as number | undefined;

    if (change === undefined || change === null) {
      return { data: null, error: "[comparison] S&P 500 change percent unavailable" };
    }

    // YTD: compute from fiftyTwoWeekLow data or use regularMarketPrice vs Jan 1
    const currentPrice = quote.regularMarketPrice as number | undefined;
    let ytdPct: number | null = null;
    let oneYearPct: number | null = null;

    if (currentPrice) {
      try {
        const now = new Date();
        const janFirst = new Date(now.getFullYear(), 0, 1);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const historical = await yahooFinance.chart("^GSPC", {
          period1: oneYearAgo,
          period2: now,
          interval: "1mo",
        }) as { quotes: { close: number; date: Date }[] };

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
    return { data: null, error: `[comparison] fetchSP500: ${(e as Error).message}` };
  }
}

export async function fetchDXY(): Promise<Result<{ change_24h_pct: number }>> {
  try {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      return { data: null, error: "[comparison] ALPHA_VANTAGE_API_KEY env var is not set" };
    }

    const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=DX-Y.NYB&apikey=${key}`;
    const res = await fetch(url);

    if (!res.ok) {
      return { data: null, error: `[comparison] Alpha Vantage returned ${res.status}` };
    }

    const json = await res.json();
    const globalQuote = json["Global Quote"];

    if (!globalQuote || !globalQuote["10. change percent"]) {
      return { data: null, error: "[comparison] DXY data missing from Alpha Vantage response" };
    }

    const raw = globalQuote["10. change percent"] as string;
    const changePct = parseFloat(raw.replace("%", ""));

    if (isNaN(changePct)) {
      return { data: null, error: `[comparison] Could not parse DXY change percent: ${raw}` };
    }

    return { data: { change_24h_pct: changePct }, error: null };
  } catch (e) {
    return { data: null, error: `[comparison] fetchDXY: ${(e as Error).message}` };
  }
}
