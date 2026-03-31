import type { Result, RawArticle } from "@/lib/types";
import { SEARCHAPI_BASE, SEARCH_QUERIES } from "@/lib/constants";
import { fetchWithTimeout } from "./fetch-timeout";

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export async function fetchSearchApiNews(): Promise<Result<RawArticle[]>> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) {
    console.warn("[searchapi] SEARCHAPI_KEY not set — skipping");
    return { data: [], error: null };
  }

  try {
    const allArticles: RawArticle[] = [];

    for (const query of SEARCH_QUERIES) {
      try {
        const url = `${SEARCHAPI_BASE}?engine=google_news&q=${encodeURIComponent(query)}&api_key=${apiKey}`;
        const res = await fetchWithTimeout(url);

        if (!res.ok) {
          console.warn(`[searchapi] Query "${query}" failed (${res.status})`);
          continue;
        }

        const json = await res.json();
        const results = json.news_results ?? json.organic_results ?? [];

        for (const item of results) {
          allArticles.push({
            title: item.title ?? "",
            url: item.link ?? item.url ?? "",
            source: item.source?.name ?? item.source ?? "SearchAPI",
            published_at: item.date ?? item.published_date ?? new Date().toISOString(),
            description: item.snippet ?? item.description ?? undefined,
          });
        }
      } catch (queryErr) {
        console.warn(`[searchapi] Query "${query}" error: ${(queryErr as Error).message}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduplicated: RawArticle[] = [];
    for (const article of allArticles) {
      const key = normalizeUrl(article.url);
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(article);
      }
    }

    console.log(`[searchapi] raw=${allArticles.length} → deduplicated=${deduplicated.length}`);
    return { data: deduplicated, error: null };
  } catch (e) {
    return { data: null, error: `[searchapi] ${(e as Error).message}` };
  }
}

export async function fetchForwardLookingContext(): Promise<Result<string[]>> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) {
    return { data: [], error: null };
  }

  try {
    const url = `${SEARCHAPI_BASE}?engine=google_news&q=${encodeURIComponent("Bitcoin upcoming regulation FOMC ETF institutional macro")}&api_key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      return { data: [], error: null };
    }

    const json = await res.json();
    const results = json.news_results ?? json.organic_results ?? [];
    const headlines: string[] = [];

    for (const item of results) {
      const title = item.title ?? "";
      const source = item.source?.name ?? item.source ?? "";
      if (title) {
        headlines.push(`${title} (${source})`);
      }
    }

    console.log(`[searchapi] forward-looking headlines: ${headlines.length}`);
    return { data: headlines, error: null };
  } catch (e) {
    return { data: null, error: `[searchapi] forward: ${(e as Error).message}` };
  }
}

