import type { TopStory, RegulatoryUpdate, AdoptionUpdate } from "@/lib/types";

// Small stopword list tuned for news headlines. Anything here gets stripped
// before the title-signature comparison, so "the Fed" and "Fed" collapse.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "that", "this",
  "these", "those", "over", "under", "after", "before", "about", "against",
  "between", "through", "across", "behind", "above", "below", "beside",
  "will", "would", "could", "should", "may", "might", "must", "shall",
  "have", "has", "had", "not", "but", "are", "was", "were", "been", "being",
  "they", "them", "their", "there", "where", "when", "what", "which", "who",
  "how", "why", "its", "his", "her", "our", "your", "ours", "yours", "also",
]);

function normalizeUrlKey(url: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = u.pathname
      .toLowerCase()
      .replace(/\/amp\/?$/, "")
      .replace(/\.amp$/, "")
      .replace(/\/+$/, "");
    return `${hostname}${pathname}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}

function titleSignature(headline: string): string {
  const raw = (headline ?? "").toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 6)
    .join(" ");
}

interface StoriesShape {
  top_stories?: TopStory[];
  regulatory?: RegulatoryUpdate[];
  adoption?: AdoptionUpdate[];
}

// Priority: top_stories > regulatory > adoption. Top stories is the most
// prominent display slot, so on collision we keep the item there and drop
// it from the specific sections. Specific sections may become empty, which
// the display components already handle by hiding themselves. Within each
// section, later occurrences of the same URL or title signature are also
// dropped. This is the ABSOLUTE guarantee against duplicates — runs both
// at pipeline time (forward fix) and at display time (backfills existing
// briefings saved before this helper existed).
export function dedupeBriefingStories<T extends StoriesShape>(briefing: T): T {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  function takeIfNew(item: { url?: string; headline?: string }): boolean {
    const urlKey = normalizeUrlKey(item.url ?? "");
    const titleKey = titleSignature(item.headline ?? "");
    if (urlKey && seenUrls.has(urlKey)) return false;
    if (titleKey && seenTitles.has(titleKey)) return false;
    if (urlKey) seenUrls.add(urlKey);
    if (titleKey) seenTitles.add(titleKey);
    return true;
  }

  const top_stories = (briefing.top_stories ?? []).filter(takeIfNew);
  const regulatory = (briefing.regulatory ?? []).filter(takeIfNew);
  const adoption = (briefing.adoption ?? []).filter(takeIfNew);

  return { ...briefing, top_stories, regulatory, adoption } as T;
}
