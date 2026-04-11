import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import type {
  RawArticle,
  TriageItem,
  TriageOutput,
  PerplexityCrossRefOutput,
} from "@/lib/types";

// ─── URL normalization (shared) ───────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

// ─── Triage system prompt ─────────────────────────────────────────────────

const TRIAGE_SYSTEM = `You are a Bitcoin news triage analyst. Your job is to quickly scan headlines and snippets to identify the 15 most important stories for an institutional-grade Bitcoin daily briefing.

CRITICAL: Return ONLY valid JSON. No markdown fences, no extra text, no comments.

Return a JSON object with a single key "ranked" containing an array of up to 15 items, ordered by importance (most important first).

Each item:
{
  "index": <0-based index from the input list>,
  "url": "<exact URL from input>",
  "importance": <1-10 integer>,
  "reasoning": "<one sentence explaining why this matters for Bitcoin investors>"
}

Scoring guidance:
- 9-10: Market-moving (ETF approval, major sovereign adoption, Fed pivot, >5% price move)
- 7-8: Significant institutional signal (large treasury purchase, regulatory shift, mining policy)
- 5-6: Notable but not urgent (smaller adoption stories, technical developments)
- 3-4: Marginally relevant (general macro, tangential crypto stories)
- 1-2: Low relevance (altcoin-focused, minor events)

BITCOIN ONLY: Apply strict Bitcoin-relevance filtering. Do not rank altcoin-only stories. If a story is about general crypto and Bitcoin is not the primary subject, score it 3 or below.

If fewer than 15 articles pass a minimum score of 3, return only those that do.
Never use em dashes or en dashes. Use commas, periods, or semicolons instead.`;

// ─── Perplexity cross-reference system prompt ─────────────────────────────

const CROSS_REF_SYSTEM = `You are a Bitcoin news verification assistant. Search the web for the top 5 most significant Bitcoin-related stories from the last 24 hours. Return ONLY valid JSON, no markdown fences or extra text.

{
  "stories": [
    {
      "headline": "<concise headline>",
      "source": "<publication name>",
      "url": "<full article URL>",
      "why_important": "<one sentence on why this matters>"
    }
  ]
}

Focus EXCLUSIVELY on Bitcoin (BTC). Include only stories where Bitcoin is the primary subject.
Include: ETF flows, institutional purchases, regulatory developments, network milestones, major price movements, sovereign adoption.
Exclude: altcoins, stablecoins, DeFi, NFTs, general crypto unless Bitcoin is central.
Never use em dashes or en dashes. Use commas, periods, or semicolons instead.`;

// ─── Triage task ──────────────────────────────────────────────────────────

export const triageTask = task({
  id: "news-triage",
  run: async (payload: { articles: RawArticle[] }): Promise<TriageOutput> => {
    const { articles } = payload;

    if (articles.length === 0) {
      logger.warn("No articles to triage");
      return { ranked: [] };
    }

    // Build numbered article list (headlines + snippets only, no full text)
    const articleList = articles
      .map(
        (a, i) =>
          `${i}. **${a.title}**\n   Source: ${a.source} | Published: ${a.published_at}\n   URL: ${a.url}\n   Snippet: ${a.description ?? "N/A"}`
      )
      .join("\n\n");

    const userPrompt = `## Articles to Triage (${articles.length} total)\n\n${articleList}`;

    logger.info("Calling Claude for news triage", {
      articleCount: articles.length,
    });

    const result = await callClaudeJSON<TriageOutput>({
      system: TRIAGE_SYSTEM,
      prompt: userPrompt,
      maxTokens: 2048,
    });

    if (result.error) {
      logger.error("Triage Claude call failed", { error: result.error });
      throw new Error(`Triage failed: ${result.error}`);
    }

    const output = result.data!;

    // Validate: filter out any items with index out of bounds
    output.ranked = output.ranked.filter(
      (item) => item.index >= 0 && item.index < articles.length
    );

    logger.info("Triage complete", {
      rankedCount: output.ranked.length,
      topScore: output.ranked[0]?.importance ?? 0,
    });

    return output;
  },
});

// ─── Perplexity cross-reference task ──────────────────────────────────────

export const perplexityCrossRefTask = task({
  id: "perplexity-cross-ref",
  run: async (): Promise<PerplexityCrossRefOutput> => {
    logger.info("Starting Perplexity cross-reference check");

    const result = await queryPerplexity({
      system: CROSS_REF_SYSTEM,
      prompt:
        "What are the 5 most significant Bitcoin (BTC) stories from the last 24 hours? Include the source URL for each. Focus on institutional moves, regulatory developments, ETF activity, network milestones, and major price catalysts.",
    });

    if (result.error) {
      logger.error("Perplexity cross-ref failed", { error: result.error });
      throw new Error(`Cross-ref failed: ${result.error}`);
    }

    try {
      const raw = result.data?.trim() ?? "";
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned) as PerplexityCrossRefOutput;

      if (!Array.isArray(parsed.stories)) {
        throw new Error("Expected stories array");
      }

      logger.info("Perplexity cross-ref complete", {
        storyCount: parsed.stories.length,
      });

      return parsed;
    } catch (e) {
      logger.error("Failed to parse Perplexity cross-ref JSON", {
        error: (e as Error).message,
      });
      throw e;
    }
  },
});

// ─── Merge triage results with cross-reference ───────────────────────────

export function mergeTriageWithCrossRef(
  allArticles: RawArticle[],
  triage: TriageOutput | null,
  crossRef: PerplexityCrossRefOutput | null
): {
  articlesToScrape: RawArticle[];
  triageRankings: TriageItem[];
} {
  // If triage failed entirely, fall back to top 10 by recency (current behavior)
  if (!triage || triage.ranked.length === 0) {
    logger.warn("Triage unavailable, falling back to top 10 by recency");
    return {
      articlesToScrape: allArticles.slice(0, 10),
      triageRankings: [],
    };
  }

  // Start with triage-ranked articles (up to 15)
  const triageArticles: RawArticle[] = [];
  const triageUrls = new Set<string>();

  for (const item of triage.ranked.slice(0, 15)) {
    const article = allArticles[item.index];
    if (article) {
      triageArticles.push(article);
      triageUrls.add(normalizeUrl(article.url));
    }
  }

  // Merge Perplexity cross-ref stories that triage missed
  let addedFromCrossRef = 0;
  const MAX_CROSS_REF_ADDITIONS = 3;

  if (crossRef && Array.isArray(crossRef.stories)) {
    for (const story of crossRef.stories) {
      if (addedFromCrossRef >= MAX_CROSS_REF_ADDITIONS) break;

      const normalizedStoryUrl = normalizeUrl(story.url);

      // Check if already in triage results
      if (triageUrls.has(normalizedStoryUrl)) continue;

      // Try to find this story in our collected articles by URL
      const matchByUrl = allArticles.find(
        (a) => normalizeUrl(a.url) === normalizedStoryUrl
      );

      if (matchByUrl) {
        // Story exists in our collection but wasn't ranked high enough
        triageArticles.push(matchByUrl);
        triageUrls.add(normalizedStoryUrl);
        addedFromCrossRef++;
        logger.info("Cross-ref added under-ranked article", {
          headline: matchByUrl.title,
        });
        continue;
      }

      // Try fuzzy headline match (significant word overlap)
      const storyWords = extractSignificantWords(story.headline);
      const matchByHeadline = allArticles.find((a) => {
        if (triageUrls.has(normalizeUrl(a.url))) return false;
        const articleWords = extractSignificantWords(a.title);
        return jaccardSimilarity(storyWords, articleWords) > 0.4;
      });

      if (matchByHeadline) {
        triageArticles.push(matchByHeadline);
        triageUrls.add(normalizeUrl(matchByHeadline.url));
        addedFromCrossRef++;
        logger.info("Cross-ref matched by headline similarity", {
          perplexity: story.headline,
          matched: matchByHeadline.title,
        });
        continue;
      }

      // Story not in our collection at all: create a synthetic article
      const synthetic: RawArticle = {
        title: story.headline,
        url: story.url,
        source: story.source,
        published_at: new Date().toISOString(),
        description: story.why_important,
      };
      triageArticles.push(synthetic);
      triageUrls.add(normalizedStoryUrl);
      addedFromCrossRef++;
      logger.info("Cross-ref added new story not in collection", {
        headline: story.headline,
        source: story.source,
      });
    }
  }

  logger.info("Merge complete", {
    fromTriage: triageArticles.length - addedFromCrossRef,
    fromCrossRef: addedFromCrossRef,
    total: triageArticles.length,
  });

  return {
    articlesToScrape: triageArticles,
    triageRankings: triage.ranked,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "has", "have", "had", "its",
  "it", "by", "from", "with", "as", "this", "that", "but", "not", "so",
  "if", "can", "will", "may", "new", "says", "said",
]);

function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
