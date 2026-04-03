import type { Result, ETFFlows } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";
import { SOSOVALUE_ETF_HISTORY } from "@/lib/constants";

interface SoSoValueEntry {
  date: string;
  totalNetInflow: number;
  totalNetAssets: number;
  cumNetInflow: number;
}

export async function fetchETFFlows(): Promise<Result<ETFFlows>> {
  try {
    const res = await fetchWithTimeout(
      SOSOVALUE_ETF_HISTORY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "us-btc-spot" }),
      },
      15_000,
    );

    if (!res.ok) {
      return {
        data: null,
        error: `[sosovalue] fetchETFFlows failed with status ${res.status}`,
      };
    }

    const json = await res.json();
    const entries: SoSoValueEntry[] = json.data;

    if (!entries || entries.length === 0) {
      return { data: null, error: "[sosovalue] No data returned from ETF flows API" };
    }

    // Latest entry = most recent day's flow
    const latest = entries[0];
    const dailyNetFlow = latest.totalNetInflow;
    const totalNetAssets = latest.totalNetAssets;

    // MTD = sum all entries in the same month as latest entry
    const latestDate = new Date(latest.date + "T12:00:00Z");
    const monthStart = `${latestDate.getUTCFullYear()}-${String(latestDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

    let mtdNetFlow = 0;
    for (const entry of entries) {
      if (entry.date >= monthStart) {
        mtdNetFlow += entry.totalNetInflow;
      }
    }

    return {
      data: {
        daily_net_flow_usd: dailyNetFlow,
        mtd_net_flow_usd: mtdNetFlow,
        total_net_assets_usd: totalNetAssets,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[sosovalue] ${(e as Error).message}` };
  }
}
