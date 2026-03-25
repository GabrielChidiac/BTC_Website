import type { Result } from "@/lib/types";
import { ALTERNATIVE_ME_FNG } from "@/lib/constants";

export async function fetchFearGreedIndex(): Promise<
  Result<{
    value: number;
    label: string;
  }>
> {
  try {
    const res = await fetch(`${ALTERNATIVE_ME_FNG}?limit=1`);
    if (!res.ok) {
      return {
        data: null,
        error: `[alternativeme] fetchFearGreedIndex failed with status ${res.status}`,
      };
    }

    const json = await res.json();
    const entry = json.data?.[0];

    if (!entry) {
      return { data: null, error: "[alternativeme] No data returned from Fear & Greed API" };
    }

    return {
      data: {
        value: Number(entry.value),
        label: entry.value_classification,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `[alternativeme] ${(e as Error).message}` };
  }
}
