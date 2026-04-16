import type { Result, FearGreedIndex } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";
import { ALTERNATIVE_ME_FNG } from "@/lib/constants";

interface FngResponse {
  data: { value: string; value_classification: string }[];
}

export async function fetchFearGreedIndex(): Promise<Result<FearGreedIndex>> {
  try {
    const res = await fetchWithTimeout(ALTERNATIVE_ME_FNG, undefined, 15_000);

    if (!res.ok) {
      return {
        data: null,
        error: `[alternativeme] Fear & Greed API returned status ${res.status}`,
      };
    }

    const json: FngResponse = await res.json();

    if (!json.data || json.data.length === 0) {
      return { data: null, error: "[alternativeme] No data in Fear & Greed response" };
    }

    const entry = json.data[0];
    const value = parseInt(entry.value, 10);

    if (isNaN(value) || value < 0 || value > 100) {
      return { data: null, error: `[alternativeme] Invalid F&G value: ${entry.value}` };
    }

    return {
      data: { value, label: entry.value_classification },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[alternativeme] ${(e as Error).message}` };
  }
}
