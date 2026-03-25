import type { Result, RawArticle } from "@/lib/types";
import { RSS_FEEDS } from "@/lib/constants";
import Parser from "rss-parser";

const parser = new Parser();

export async function fetchRssArticles(): Promise<Result<RawArticle[]>> {
  try {
    const allArticles: RawArticle[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const parsed = await parser.parseURL(feed.url);

        for (const item of parsed.items ?? []) {
          allArticles.push({
            title: item.title ?? "",
            url: item.link ?? "",
            source: feed.name,
            published_at: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
            description: item.contentSnippet ?? item.content ?? undefined,
          });
        }
      } catch (feedErr) {
        console.warn(`[rss] Failed to parse feed "${feed.name}": ${(feedErr as Error).message}`);
      }
    }

    return { data: allArticles, error: null };
  } catch (e) {
    return { data: null, error: `[rss] ${(e as Error).message}` };
  }
}
