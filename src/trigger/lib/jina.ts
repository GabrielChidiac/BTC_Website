import type { Result } from "@/lib/types";

const JINA_BASE = "https://r.jina.ai";
const MAX_CONTENT_LENGTH = 3000; // ~3000 chars per article to keep AI Brain prompt manageable

interface JinaResponse {
  data: {
    url: string;
    title: string;
    content: string;
  };
}

export async function extractArticleText(url: string): Promise<Result<string>> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Respond-With": "text",
      "X-Timeout": "15",
    };

    const apiKey = process.env.JINA_API_KEY;
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${JINA_BASE}/${url}`, { headers });

    if (!res.ok) {
      return { data: null, error: `[jina] HTTP ${res.status} for ${url}` };
    }

    const json = (await res.json()) as JinaResponse;
    const content = json.data?.content?.trim() ?? "";

    if (!content) {
      return { data: null, error: `[jina] Empty content for ${url}` };
    }

    // Truncate to keep prompt size manageable
    const truncated =
      content.length > MAX_CONTENT_LENGTH
        ? content.slice(0, MAX_CONTENT_LENGTH) + "..."
        : content;

    return { data: truncated, error: null };
  } catch (e) {
    return { data: null, error: `[jina] ${(e as Error).message}` };
  }
}

export async function scrapeArticles(
  articles: { url: string }[],
  limit: number = 10,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const toScrape = articles.slice(0, limit);

  // Scrape in batches of 5 to stay within 20 RPM free tier
  const BATCH_SIZE = 5;
  for (let i = 0; i < toScrape.length; i += BATCH_SIZE) {
    const batch = toScrape.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (article) => {
        const result = await extractArticleText(article.url);
        if (result.data) {
          results.set(article.url, result.data);
        }
      }),
    );

    // Log failures
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === "rejected") {
        console.warn(`[jina] Failed to scrape: ${batch[j].url}`);
      }
    }

    // Brief pause between batches to respect rate limits
    if (i + BATCH_SIZE < toScrape.length) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log(`[jina] Scraped ${results.size}/${toScrape.length} articles`);
  return results;
}
