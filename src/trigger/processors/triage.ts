import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import {
  TriageOutputSchema,
  PerplexityCrossRefOutputSchema,
} from "@/lib/schemas";
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

═══════════════════════════════════════════════════════════════════════════
IMPACT MECHANISM TEST (applied before assigning any score >= 6)
═══════════════════════════════════════════════════════════════════════════

A story may only score >= 6 if you can answer YES to all three:
1. Does it have a direct mechanism for moving BTC price, ETF flows,
   institutional positioning, Bitcoin network fundamentals, or regulatory
   authority over Bitcoin? (Not crypto-generic — specifically Bitcoin.)
2. When similar events happened historically, did BTC actually respond
   (>= 2% price move within 7 days, or flow shift >= 1σ, or sustained
   positioning change)?
3. Can you state the mechanism in one concrete sentence?

Events that historically DID move BTC (mechanism is real):
- Spot ETF approvals/denials, large daily net flows (>$500M one direction)
- Major treasury buys >$100M with named entity and confirmed allocation
- Fed rate decisions, Fed chair statements on direct BTC policy
- Sovereign adoption/ban with enacted law (not proposed)
- SEC/CFTC enforcement against top-5 BTC-touching actor
- Hashrate collapse/surge >15% MoM
- Realized vol spike >50% vs 30d average

Events that historically DID NOT meaningfully move BTC (cap at 5):
- Analyst price predictions ("$X by year Y")
- "Company considering" / "evaluating" / "studying" BTC
- Symbolic rank changes without flow mechanism (e.g. "X now holds more
  BTC than Y" when both are long-time holders — no new capital flowed)
- Confirmation hearings (testimony, not policy action)
- Conference speeches, op-eds, think-pieces
- Routine 13F disclosures showing existing positions
- Regulatory PROPOSALS unlikely to pass, or actions reversed within weeks
- Stories where BTC is mentioned in passing but not the subject

If the mechanism is unclear or symbolic, cap the score at 5 no matter how
attention-grabbing the headline sounds.

EXCEPTION CLAUSE (use SPARINGLY, max 1 per triage run):
A story that would otherwise be capped at 5 may score 6 IF one of these
applies AND you name the exception in the reasoning field:
- First-of-kind event with clear structural significance (e.g. first G20
  sovereign BTC adoption; first landmark US court ruling on BTC status)
- Narrative compound: the story is the 3rd+ in a weekly pattern pointing
  the same direction (name the other items in reasoning)
Do not use exceptions to sneak in hype. If you apply more than one
exception in a single run, you are abusing the rule.

═══════════════════════════════════════════════════════════════════════════
SCORING RUBRIC (anchored to real historical events, not opinion)
═══════════════════════════════════════════════════════════════════════════

Baseline expectation across a typical week: roughly 0-1 stories reach 9-10,
2-4 stories reach 7-8, 5-8 stories reach 5-6, the rest 1-4. If you are
producing 5 stories at score 9+ on an ordinary day, you are inflating.

────────────────────────────────────────────────────────────
SCORE 9-10 — Market-moving, rare, structural
────────────────────────────────────────────────────────────
Must have PROVEN or HIGHLY LIKELY direct impact on BTC price or the thesis.

Anchor examples (historical):
- Spot Bitcoin ETF approval by SEC (Jan 2024) = 10
- China bans Bitcoin mining (May 2021) = 10
- El Salvador adopts BTC as legal tender (Sep 2021) = 10
- A sitting G7 or G20 central bank announces BTC as reserve asset = 10
- Fed emergency rate cut or hike = 9
- >7% BTC intraday move with identified catalyst = 9
- US executive order with direct BTC implications (e.g. strategic reserve) = 9

NOT 9-10 (common errors):
- A company of any size announcing "crypto curious" interest
- "Analyst predicts $X price" (prediction is not event)
- Altcoin-focused news even if it mentions BTC
- Regulatory MOVES that are proposed but not enacted unless the move itself is a market event

────────────────────────────────────────────────────────────
SCORE 7-8 — Significant institutional or regulatory signal
────────────────────────────────────────────────────────────
Must have IDENTIFIABLE IMPACT on institutional flows, positioning, or policy.

Anchor examples:
- Public company adds $500M+ in BTC to treasury = 8
- Public company adds $100M-$500M = 7
- Major ETF daily net flow >$500M in one direction = 7
- SEC enforcement action against a major actor (not routine) = 7-8
- Passage (not proposal) of Bitcoin-related legislation in a major jurisdiction = 8
- Pension fund or sovereign wealth fund first BTC allocation = 8
- Mining hash rate collapse or surge >15% month-over-month = 7
- Lightning Network TPS milestone or major fee market shift = 7

NOT 7-8:
- "Company considering" or "company to evaluate" BTC (not an event)
- Small treasury additions <$50M
- Routine 13F filings showing existing positions
- Individual wealth-manager opinions or newsletter predictions

────────────────────────────────────────────────────────────
SCORE 5-6 — Notable, developmental, worth reading
────────────────────────────────────────────────────────────
Real information, not urgent, does not move positioning by itself.

Anchor examples:
- Small corporate treasury addition ($10M-$50M) = 5-6
- Merchant adoption milestone in a secondary market = 5
- Technical development (BIP progress, Core release, Lightning feature) = 5-6
- Smaller-market national central bank study or position paper = 6
- Secondary ETF filing (not first-of-kind) = 5
- Hashrate all-time high = 5-6
- Well-known analyst or institution publishing a substantive report on BTC = 5-6

NOT 5-6:
- Hype pieces without data
- Price-prediction articles
- "Top 10 reasons Bitcoin is..." list content

────────────────────────────────────────────────────────────
SCORE 3-4 — Marginal, probably skip in the brief
────────────────────────────────────────────────────────────
- General macro news without direct Bitcoin mechanism
- Tangential crypto industry stories (mixed-asset context)
- Minor network stats, routine difficulty adjustments
- Speculation or opinion without new information

────────────────────────────────────────────────────────────
SCORE 1-2 — Near-zero Bitcoin relevance
────────────────────────────────────────────────────────────
- Altcoin-focused stories with only incidental BTC mention
- Clickbait, scams, recycled content
- Crypto stories where Bitcoin is not the subject

═══════════════════════════════════════════════════════════════════════════

BITCOIN ONLY: Apply strict Bitcoin-relevance filtering. If a story is about
general crypto and Bitcoin is not the primary subject, score it 3 or below.
A story about "crypto regulation" that names only stablecoins and altcoins
is a 1-2 even if it mentions BTC in passing.

CALIBRATION TEST before you finalize: on a typical weekday, how many stories
SHOULD score 9-10? Answer: 0 or 1. If you're about to submit 3+ stories at
9-10, re-read them and ask "is this really on par with the 2024 ETF approval
or China's mining ban?" If not, downgrade.

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
  run: async (payload: { articles?: RawArticle[] }): Promise<TriageOutput> => {
    const articles = payload?.articles ?? [];

    if (articles.length === 0) {
      logger.warn("No articles to triage (empty or missing articles payload)");
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
      schema: TriageOutputSchema,
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
      const parsedUnknown: unknown = JSON.parse(cleaned);

      const validation = PerplexityCrossRefOutputSchema.safeParse(parsedUnknown);
      if (!validation.success) {
        throw new Error(
          `Perplexity cross-ref schema validation failed: ${validation.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ")}`
        );
      }

      const parsed: PerplexityCrossRefOutput = validation.data;

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
