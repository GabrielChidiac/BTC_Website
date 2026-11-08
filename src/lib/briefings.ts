import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { BriefingJSON } from "@/lib/types";

/**
 * Cached reads of `daily_briefings` for the website.
 *
 * Pages call getSubscriberTier() (cookies) so they always render dynamically;
 * route-level `revalidate` does nothing for them. Caching the data layer here
 * keeps Supabase egress flat regardless of traffic (bots included).
 * The pipeline's revalidate step busts everything via BRIEFINGS_TAG.
 */
export const BRIEFINGS_TAG = "briefings";

const ONE_HOUR = 3600;
const ONE_DAY = 86400;

export interface BriefingRecord {
  date: string;
  content: BriefingJSON;
  updated_at: string;
}

export interface ArchiveIndexRow {
  date: string;
  price: number;
  change24h: number;
  oneLine: string | null;
  consensusLabel: string | null;
}

export const getLatestBriefing = unstable_cache(
  async (): Promise<BriefingRecord | null> => {
    const { data } = await createPublicClient()
      .from("daily_briefings")
      .select("date, content, updated_at")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as BriefingRecord | null) ?? null;
  },
  ["latest-briefing"],
  { revalidate: ONE_HOUR, tags: [BRIEFINGS_TAG] }
);

export const getBriefingByDate = unstable_cache(
  async (date: string): Promise<BriefingRecord | null> => {
    const { data } = await createPublicClient()
      .from("daily_briefings")
      .select("date, content, updated_at")
      .eq("date", date)
      .maybeSingle();
    return (data as BriefingRecord | null) ?? null;
  },
  ["briefing-by-date"],
  { revalidate: ONE_DAY, tags: [BRIEFINGS_TAG] }
);

/** All briefing dates, newest first. */
export const getBriefingDates = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await createPublicClient()
      .from("daily_briefings")
      .select("date")
      .order("date", { ascending: false });
    return (data ?? []).map((row: { date: string }) => row.date);
  },
  ["briefing-dates"],
  { revalidate: ONE_HOUR, tags: [BRIEFINGS_TAG] }
);

/** Archive list rows, newest first. Pulls only the five displayed fields, not full content. */
export const getArchiveIndex = unstable_cache(
  async (): Promise<ArchiveIndexRow[]> => {
    const { data } = await createPublicClient()
      .from("daily_briefings")
      .select(
        "date, price:content->market_snapshot->price_usd, change24h:content->market_snapshot->change_24h_pct, oneLine:content->>one_line, consensusLabel:content->narrative_consensus->>label"
      )
      .order("date", { ascending: false });
    return ((data ?? []) as unknown as ArchiveIndexRow[]).map((row) => ({
      date: row.date,
      price: Number(row.price),
      change24h: Number(row.change24h),
      oneLine: row.oneLine ?? null,
      consensusLabel: row.consensusLabel ?? null,
    }));
  },
  ["archive-index"],
  { revalidate: ONE_HOUR, tags: [BRIEFINGS_TAG] }
);
