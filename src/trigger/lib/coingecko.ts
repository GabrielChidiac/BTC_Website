import type { Result } from "@/lib/types";
import { COINGECKO_BASE } from "@/lib/constants";
import { fetchWithTimeout } from "./fetch-timeout";

function headers(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

async function cgFetch(path: string): Promise<Response> {
  return fetchWithTimeout(`${COINGECKO_BASE}${path}`, { headers: headers() });
}

export async function fetchBtcPrice(): Promise<
  Result<{
    usd: number;
    change_24h_pct: number;
    change_7d_pct: number;
    market_cap_usd: number;
    volume_24h_usd: number;
    change_1y_pct: number | null;
    ath_usd: number | null;
    ath_date: string | null;
  }>
> {
  try {
    const res = await cgFetch(
      "/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false"
    );
    if (!res.ok) {
      return { data: null, error: `[coingecko] fetchBtcPrice failed with status ${res.status}` };
    }

    const json = await res.json();
    const md = json.market_data;

    return {
      data: {
        usd: md.current_price.usd,
        change_24h_pct: md.price_change_percentage_24h,
        change_7d_pct: md.price_change_percentage_7d,
        market_cap_usd: md.market_cap.usd,
        volume_24h_usd: md.total_volume.usd,
        change_1y_pct: md.price_change_percentage_1y ?? null,
        ath_usd: md.ath?.usd ?? null,
        ath_date: md.ath_date?.usd ?? null,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}

export async function fetchGlobalData(): Promise<Result<{ dominance_pct: number }>> {
  try {
    const res = await cgFetch("/global");
    if (!res.ok) {
      return { data: null, error: `[coingecko] fetchGlobalData failed with status ${res.status}` };
    }

    const json = await res.json();
    return {
      data: { dominance_pct: json.data.market_cap_percentage.btc },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}

export async function fetchHistoricalPrices(days: number): Promise<Result<number[]>> {
  try {
    const res = await cgFetch(
      `/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
    );
    if (!res.ok) {
      return {
        data: null,
        error: `[coingecko] fetchHistoricalPrices failed with status ${res.status}`,
      };
    }

    const json = await res.json();
    const closingPrices: number[] = json.prices.map(
      (entry: [number, number]) => entry[1]
    );

    return { data: closingPrices, error: null };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}

// Fetch BTC USD closing price at a specific UTC calendar date. Used by the
// prediction resolver to score up/down/flat calls against the actual price
// that existed on the briefing date and target date. CoinGecko's /history
// endpoint wants DD-MM-YYYY (not ISO); we convert here.
export async function fetchBtcCloseAtDate(
  isoDate: string
): Promise<Result<number>> {
  try {
    const [yyyy, mm, dd] = isoDate.split("-");
    if (!yyyy || !mm || !dd) {
      return { data: null, error: `[coingecko] invalid ISO date: ${isoDate}` };
    }

    const res = await cgFetch(
      `/coins/bitcoin/history?date=${dd}-${mm}-${yyyy}&localization=false`
    );
    if (!res.ok) {
      return {
        data: null,
        error: `[coingecko] fetchBtcCloseAtDate(${isoDate}) failed with status ${res.status}`,
      };
    }

    const json = await res.json();
    const usd = json?.market_data?.current_price?.usd;
    if (typeof usd !== "number" || !isFinite(usd) || usd <= 0) {
      return {
        data: null,
        error: `[coingecko] fetchBtcCloseAtDate(${isoDate}) returned no usable price`,
      };
    }

    return { data: usd, error: null };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}

export async function fetchOHLC(days: number): Promise<Result<{ highs: number[]; lows: number[] }>> {
  try {
    const res = await cgFetch(
      `/coins/bitcoin/ohlc?vs_currency=usd&days=${days}`
    );
    if (!res.ok) {
      return { data: null, error: `[coingecko] fetchOHLC failed with status ${res.status}` };
    }

    // Each entry: [timestamp, open, high, low, close]
    const json: [number, number, number, number, number][] = await res.json();
    const highs = json.map((candle) => candle[2]);
    const lows = json.map((candle) => candle[3]);

    return { data: { highs, lows }, error: null };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}

// Gold price now fetched via Yahoo Finance (GC=F) in comparison.ts
