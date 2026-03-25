import type { Result } from "@/lib/types";
import { COINGECKO_BASE } from "@/lib/constants";

function headers(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

async function cgFetch(path: string): Promise<Response> {
  return fetch(`${COINGECKO_BASE}${path}`, { headers: headers() });
}

export async function fetchBtcPrice(): Promise<
  Result<{
    usd: number;
    change_24h_pct: number;
    change_7d_pct: number;
    market_cap_usd: number;
    volume_24h_usd: number;
    change_1y_pct: number | null;
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

export async function fetchGoldPrice(): Promise<Result<{ gold_price_usd: number }>> {
  try {
    const res = await cgFetch("/simple/price?ids=bitcoin&vs_currencies=usd,xau");
    if (!res.ok) {
      return { data: null, error: `[coingecko] fetchGoldPrice failed with status ${res.status}` };
    }

    const json = await res.json();
    const btcUsd: number = json.bitcoin.usd;
    const btcXau: number = json.bitcoin.xau;

    const goldPriceUsd = btcUsd / btcXau;

    return { data: { gold_price_usd: goldPriceUsd }, error: null };
  } catch (e) {
    return { data: null, error: `[coingecko] ${(e as Error).message}` };
  }
}
