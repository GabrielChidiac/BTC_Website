import type { Result, RawArticle } from "@/lib/types";
import { SEARCHAPI_BASE, SEARCH_QUERIES } from "@/lib/constants";

export async function fetchSearchApiNews(): Promise<Result<RawArticle[]>> {
  try {
    const key = process.env.SEARCHAPI_KEY;
    if (!key) {
      return { data: null, error: "[searchapi] SEARCHAPI_KEY env var is not set" };
    }

    const allArticles: RawArticle[] = [];
    const seenUrls = new Set<string>();

    for (const query of SEARCH_QUERIES) {
      const url = `${SEARCHAPI_BASE}?engine=google_news&q=${encodeURIComponent(query)}&api_key=${key}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.warn(`[searchapi] Query "${query}" failed with status ${res.status}`);
        continue;
      }

      const json = await res.json();
      const results = json.news_results ?? [];

      for (const item of results) {
        const articleUrl = item.link ?? item.url;
        if (!articleUrl || seenUrls.has(articleUrl)) continue;
        seenUrls.add(articleUrl);

        allArticles.push({
          title: item.title ?? "",
          url: articleUrl,
          source: item.source?.name ?? item.source ?? "",
          published_at: item.date ?? new Date().toISOString(),
          description: item.snippet ?? item.description ?? undefined,
        });
      }
    }

    return { data: allArticles, error: null };
  } catch (e) {
    return { data: null, error: `[searchapi] ${(e as Error).message}` };
  }
}
