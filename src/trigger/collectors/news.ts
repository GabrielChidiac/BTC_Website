import { task } from "@trigger.dev/sdk/v3";
import type { NewsCollectorOutput, RawArticle } from "@/lib/types";
import { isWithinHours } from "@/lib/utils";
import { fetchRssArticles } from "@/trigger/lib/rss";

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export const newsCollector = task({
  id: "news-collector",
  run: async ({ date }: { date: string }): Promise<NewsCollectorOutput> => {
    const result = await fetchRssArticles();

    if (result.error || !result.data) {
      console.warn(`[news-collector] RSS fetch error: ${result.error}`);
      return { articles: [] };
    }

    const articles = result.data;
    const rawCount = articles.length;

    // Deduplicate by normalized URL
    const seen = new Set<string>();
    const deduplicated: RawArticle[] = [];
    for (const article of articles) {
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
