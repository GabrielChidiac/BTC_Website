import { task } from "@trigger.dev/sdk/v3";
import type { NewsCollectorOutput, RawArticle } from "@/lib/types";
import { isWithinHours } from "@/lib/utils";
import { fetchSearchApiNews } from "@/trigger/lib/searchapi";
import { fetchRssArticles } from "@/trigger/lib/rss";

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export const newsCollector = task({
  id: "news-collector",
  run: async ({ date }: { date: string }): Promise<NewsCollectorOutput> => {
    const results = await Promise.allSettled([
      fetchSearchApiNews(),
      fetchRssArticles(),
    ]);

    const merged: RawArticle[] = [];

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.error === null) {
        merged.push(...result.value.data);
      } else if (result.status === "fulfilled") {
        console.warn(`[news-collector] Wrapper returned error: ${result.value.error}`);
      } else {
        console.warn(`[news-collector] Wrapper rejected: ${result.reason}`);
      }
    }

    const rawCount = merged.length;

    // Deduplicate by normalized URL
    const seen = new Set<string>();
    const deduplicated: RawArticle[] = [];
    for (const article of merged) {
      const key = normalizeUrl(article.url);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(article);
      }
    }

    const deduplicatedCount = deduplicated.length;

    // Filter to last 24 hours
    const recent = deduplicated.filter((article) =>
      isWithinHours(article.published_at, 24)
    );

    // Sort by published_at descending (newest first)
    recent.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    console.log(
      `[news-collector] raw=${rawCount} → deduplicated=${deduplicatedCount} → final=${recent.length}`
    );

    return { articles: recent };
  },
});
