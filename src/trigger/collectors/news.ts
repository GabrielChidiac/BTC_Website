import { task } from "@trigger.dev/sdk/v3";
import type { NewsCollectorOutput, RawArticle } from "@/lib/types";
import { isWithinHours } from "@/lib/utils";
import { fetchRssArticles } from "@/trigger/lib/rss";
import { fetchSearchApiNews } from "@/trigger/lib/searchapi";
import { scrapeArticles } from "@/trigger/lib/jina";

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export const newsCollector = task({
  id: "news-collector",
  run: async ({ date }: { date: string }): Promise<NewsCollectorOutput> => {
    // Fetch from both sources in parallel (either failing is non-fatal)
    const [rssResult, searchResult] = await Promise.allSettled([
      fetchRssArticles(),
      fetchSearchApiNews(),
    ]);

    const rssArticles: RawArticle[] =
      rssResult.status === "fulfilled" && rssResult.value.data
        ? rssResult.value.data
        : [];

    const searchArticles: RawArticle[] =
      searchResult.status === "fulfilled" && searchResult.value.data
        ? searchResult.value.data
        : [];

    if (rssResult.status === "rejected" || rssResult.value.error) {
      console.warn(`[news-collector] RSS fetch error: ${rssResult.status === "rejected" ? rssResult.reason : rssResult.value.error}`);
    }
    if (searchResult.status === "rejected" || searchResult.value.error) {
      console.warn(`[news-collector] SearchAPI fetch error: ${searchResult.status === "rejected" ? searchResult.reason : searchResult.value.error}`);
    }

    // Merge both sources
    const allArticles = [...rssArticles, ...searchArticles];

    // Deduplicate by normalized URL
    const seen = new Set<string>();
    const deduplicated: RawArticle[] = [];
    for (const article of allArticles) {
      const key = normalizeUrl(article.url);
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(article);
      }
    }

    // Filter to last 24 hours
    const recent = deduplicated.filter((article) =>
      isWithinHours(article.published_at, 24)
    );

    // Sort by published_at descending (newest first)
    recent.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    // Pre-filter for BTC relevance (lightweight keyword check)
    const BTC_KEYWORDS = /\b(bitcoin|btc|satoshi|sats|halving|lightning network|mining|hashrate|block reward|digital gold)\b/i;
    const ALTCOIN_ONLY = /\b(ethereum|solana|xrp|tron|trx|cardano|polkadot|dogecoin|shiba|avalanche|chainlink|stablecoin|tether|polymarket|nft|defi)\b/i;

    const btcRelevant = recent.filter((article) => {
      const text = `${article.title} ${article.description ?? ""}`;
      if (BTC_KEYWORDS.test(text)) return true;
      if (ALTCOIN_ONLY.test(text)) return false;
      return true; // Keep general macro/regulatory articles
    });

    console.log(
      `[news-collector] rss=${rssArticles.length} searchapi=${searchArticles.length} → deduplicated=${deduplicated.length} → recent=${recent.length} → btcRelevant=${btcRelevant.length}`
    );

    // Scrape full article text for top 10 articles via Jina Reader (non-fatal)
    try {
      const scraped = await scrapeArticles(btcRelevant, 10);
      for (const article of btcRelevant) {
        const fullText = scraped.get(article.url);
        if (fullText) {
          article.content = fullText;
        }
      }
      console.log(`[news-collector] Enriched ${scraped.size} articles with full text`);
    } catch (e) {
      console.warn(`[news-collector] Jina scraping failed — continuing with headlines only: ${(e as Error).message}`);
    }

    return { articles: btcRelevant };
  },
});
