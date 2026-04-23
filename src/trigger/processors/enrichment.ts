import { task, logger } from "@trigger.dev/sdk/v3";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import { fetchForwardLookingContext } from "@/trigger/lib/searchapi";
import { getExpertPhotoUrls } from "@/lib/expert-photos";
import { EXPERT_CONTEXT_DIGEST } from "@/trigger/processors/expert-context";
import { ExpertInsightsArraySchema } from "@/lib/schemas";
import type { z } from "zod";

type ParsedExpertInsight = z.infer<typeof ExpertInsightsArraySchema>[number];
import type {
  TopStory,
  RawArticle,
  InstitutionalFlows,
  SupplyDynamics,
  ExpertInsight,
} from "@/lib/types";

const EXPERT_CONTEXT_ENABLED = process.env.EXPERT_CONTEXT_ENABLED !== "false";

// ─── Looking Ahead ──────────────────────────────────────────────────────────

const LOOKING_AHEAD_SYSTEM = `You are a senior macro-financial analyst and Bitcoin strategist writing the forward-looking section for an institutional-grade daily briefing. Your audience is high-net-worth investors and business executives. Use your web search capabilities to find the very latest developments.

CRITICAL OUTPUT CONSTRAINT: Return ONLY the 3 paragraphs of analysis. Nothing else. Do NOT include any preamble, meta-commentary, disclaimers, or remarks about your instructions, constraints, or role. Do NOT reference "the briefing," "my instructions," "this section," or anything self-referential. Start directly with paragraph 1.

CRITICAL: This section is EXCLUSIVELY about Bitcoin. Do NOT mention altcoins (Ethereum, Solana, XRP, Cardano, etc.), stablecoins, prediction markets, or non-Bitcoin crypto projects unless they have a direct, material impact on Bitcoin's price or adoption. No Polymarket, no Tron unless it directly affects BTC.

Guidelines:
- Write 3 concise, substantive paragraphs (not 4-5). Keep it tight and high-signal.
- Paragraph themes: (1) macro catalysts affecting Bitcoin (Fed policy, CPI, yields, DXY), (2) Bitcoin-specific regulatory and institutional signals (ETF flows, SEC deadlines, corporate treasury moves), (3) Bitcoin technical levels and on-chain data worth watching
- Integrate specific data points (prices, percentages, dates, names) naturally
- Be forward-looking: tell the reader what to WATCH FOR in the next 24-72 hours
- Do NOT use markdown formatting. Return plain text only
- Do NOT include citation markers like [1], [2], [3] or any bracketed references
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead
- No bullet points. Write in flowing editorial prose like the Financial Times
- Close on a constructive note grounded in verifiable Bitcoin-specific data (institutional inflows, network fundamentals, supply scarcity). Never fabricate.
- FRAMING WITHOUT ADVICE: never use "buy", "sell", "hold", "should", "recommend", "consider buying", "consider selling", "good opportunity", "time to". Use historical-pattern framing instead: "historically X preceded Y", "this reinforces/undermines the thesis that Z", "positioning has shifted toward X while flows remained Y". The reader decides; you report and frame.`;

interface LookingAheadContext {
  top_stories: TopStory[];
  all_articles: RawArticle[];
  forward_headlines: string[];
  market_summary: string | null;
  briefing_summary: EnrichmentPayload["briefing_summary"];
}

function buildLookingAheadPrompt(ctx: LookingAheadContext): string {
  const parts: string[] = [];

  if (EXPERT_CONTEXT_ENABLED) {
    parts.push(`## ANALYTICAL PRIORS
Use the priors below to inform framing, but only where a prior genuinely fits today's data. Do not reach for a lens mechanically.

${EXPERT_CONTEXT_DIGEST}\n`);
  }

  parts.push("TODAY'S COMPLETE BITCOIN INTELLIGENCE:\n");

  // All analyzed top stories
  if (ctx.top_stories.length > 0) {
    parts.push("## Key Stories (AI-analyzed)");
    for (const s of ctx.top_stories) {
      parts.push(`- [${s.sentiment}] "${s.headline}" (${s.source}): ${s.summary}`);
    }
    parts.push("");
  }

  // Additional article headlines for breadth (cap at 30)
  const extraArticles = ctx.all_articles
    .filter((a) => !ctx.top_stories.some((s) => s.url === a.url))
    .slice(0, 30);
  if (extraArticles.length > 0) {
    parts.push("## Additional Headlines (broader coverage)");
    for (const a of extraArticles) {
      parts.push(`- "${a.title}" (${a.source})`);
    }
    parts.push("");
  }

  // Forward-looking headlines from SearchAPI
  if (ctx.forward_headlines.length > 0) {
    parts.push("## Upcoming Events Intelligence (web-scraped)");
    for (const h of ctx.forward_headlines.slice(0, 20)) {
      parts.push(`- ${h}`);
    }
    parts.push("");
  }

  // Market state
  if (ctx.market_summary) {
    parts.push("## Market State");
    parts.push(ctx.market_summary);
    parts.push("");
  }

  // Briefing summary from AI Brain
  if (ctx.briefing_summary) {
    const bs = ctx.briefing_summary;
    parts.push("## Current Narrative & Analysis");
    if (bs.one_line) parts.push(`Key insight: ${bs.one_line}`);
    if (bs.narrative_label) parts.push(`Consensus: ${bs.narrative_label} (score: ${bs.narrative_score}/100)`);
    if (bs.macro_narrative) parts.push(`Macro context: ${bs.macro_narrative}`);
    if (bs.technical_summary) parts.push(`Technical: ${bs.technical_summary}`);
    parts.push("");
  }

  parts.push("Using the intelligence above, write the 3-paragraph forward outlook now. Search the web for any additional upcoming events not covered above. Start directly with paragraph 1, no preamble.");

  return parts.join("\n");
}

// ─── Institutional Flows ────────────────────────────────────────────────────

const FLOWS_SYSTEM = `You are a financial data analyst covering institutional Bitcoin activity. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

IMPORTANT: Do NOT include ETF flow data (daily inflows/outflows, AUM, fund-level breakdowns like GBTC/IBIT). ETF data is already sourced separately. Focus EXCLUSIVELY on non-ETF institutional activity.

ZERO-HALLUCINATION RULE: every notable move MUST include a verifiable source_url pointing directly to the primary source (SEC filing, corporate press release, on-chain transaction explorer, company tweet, etc.). If you cannot produce a real URL for a move, DO NOT include it. An empty array is the correct output when no verifiable moves can be found. Never fabricate a URL, never reuse a URL that does not contain the claim, never cite rumor or social media speculation without a direct link.

Search for the latest institutional Bitcoin activity and return the data in this exact JSON format:

{
  "summary": "<one short sentence introducing the institutional theme this week, max 12 words>",
  "notable_moves": [
    { "text": "<entity + action + specific numbers>", "source_url": "<https URL to primary source>" },
    ...
  ]
}

Rules:
- summary: one short sentence that frames the moves below. E.g. "Corporate treasuries led accumulation this week." or "Quiet week for institutional activity outside ETFs." On genuinely quiet weeks, write "Quiet week for non-ETF institutional activity." and return an empty notable_moves array rather than padding.
- notable_moves: 0-5 notable moves from the categories below. Each object MUST contain a 'text' field and a 'source_url' field. EARNED SIGNIFICANCE: a quiet week should return 0-2 genuine moves, not 5 padded ones. Never fabricate, never inflate, never guess a URL.
  Categories to cover:
  * Corporate treasury purchases/sales (MicroStrategy, Tesla, Block, Metaplanet, etc.) — cite the SEC 8-K or corporate press release URL
  * Whale wallet movements (large on-chain transfers to/from exchanges, dormant wallet activity) — cite the blockchain explorer or an on-chain analytics tweet with the tx hash
  * Fund allocations and rebalancing (hedge funds, sovereign wealth funds, pension funds adding/reducing BTC exposure) — cite the 13F filing URL or fund press release
  * OTC desk activity and trends — cite the desk's own published commentary or a verifiable Bloomberg/Reuters article URL
  * Mining company activity (treasury strategy changes, BTC sales/accumulation) — cite the company filing or press release URL
- Use real, verified data only. Do not fabricate numbers. Do not invent dates.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Expert Insights ────────────────────────────────────────────────────────

const EXPERTS_SYSTEM = `You are a financial media analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

ZERO-HALLUCINATION RULE (highest priority): every expert entry MUST include a verifiable source_url pointing to the primary source of the quote (YouTube video URL with timestamp, exact tweet URL, Substack post permalink, podcast episode URL, news article URL). If you cannot produce a real URL to the exact place the quote was said, DO NOT include that expert. An empty array is the correct output when no verifiable recent commentary exists; a fabricated quote with a plausible-sounding attribution is a critical failure that directly misleads readers. Never guess a URL, never cite a general profile page (e.g., "https://twitter.com/saylor") when the quote is not there, never invent an episode number.

Search for the most recent notable commentary on Bitcoin from well-known public figures. Search across ALL media formats: YouTube interviews, podcasts, X/Twitter posts, Bloomberg/CNBC TV appearances, conference talks, Substack newsletters, and written commentary. Substack is a HIGH-PRIORITY source; many top analysts publish their best research there (Lyn Alden, Dylan LeClair, Luke Gromen, Jeff Park, etc.). Cast a wide net.

Return an array of 0 to 3 experts in this JSON format:
[
  {
    "expert_name": "<full name>",
    "role": "<title/role>",
    "twitter_handle": "<X/Twitter handle without @ symbol, or null if unknown>",
    "quote_or_summary": "<2-3 sentence summary or direct quote of their most recent key Bitcoin insight>",
    "source": "<specific source label: 'YouTube: What Bitcoin Did ep. 891', 'Substack: Lyn Alden, Fiscal Monitor Update', 'X post', etc.>",
    "source_url": "<https URL to the exact primary source (video, tweet, Substack post, podcast page, article)>",
    "date": "<YYYY-MM-DD or approximate>"
  }
]

Rules:
- Return between 0 and 3 experts. EMPTY ARRAY IS A VALID OUTPUT when no expert has produced recent commentary you can verify with a URL. Do NOT pad. Do NOT widen the window so far that the commentary is no longer recent. Do NOT reach for a household name just to fill the slot.
- EARNED SIGNIFICANCE: 1 genuinely substantive, URL-verified voice beats 3 where two are padding. If only 1 expert has said something substantive and URL-verifiable, return 1. If none, return [].
- Every expert MUST be someone deeply in the Bitcoin space with real skin in the game: builders, fund managers, on-chain analysts, miners, protocol developers, macro strategists who actively cover BTC, or executives running Bitcoin-focused companies.
- WELL-KNOWN figures (Michael Saylor, Cathie Wood, Larry Fink, Raoul Pal, Lyn Alden, Stanley Druckenmiller, Jeff Park, Luke Gromen, Matt Hougan, Jan van Eck) are great when they have recent commentary you can link to; do NOT default to them if a lesser-known expert said something more insightful this week.
- ALSO CONSIDER deep Bitcoin analysts and researchers: Dylan LeClair, Willy Woo, James Check (Checkmate), Will Clemente, Sam Callahan, Joe Burnett, Pierre Rochard, Tuur Demeester, Adam Back, Jameson Lopp, Nic Carter, Preston Pysh, Greg Foss, Alex Gladstein, and similar Bitcoin-native voices.
- NEVER include random commentators with no track record in Bitcoin, unnamed analysts, or people who just make price predictions without substance.
- Every entry MUST be a named individual person, never a firm or team.
- Use the most recent commentary available (preferably within the last 7 days).
- Use real, recent quotes/insights only. DO NOT FABRICATE. DO NOT PARAPHRASE BEYOND RECOGNITION. A light paraphrase that preserves the speaker's claim is acceptable; a reconstruction from "things they typically say" is not.
- source_url must be the direct link to the primary source where the quote appears. Acceptable examples:
  * "https://www.youtube.com/watch?v=<id>&t=<timestamp>"
  * "https://x.com/<handle>/status/<id>"
  * "https://<substack>.substack.com/p/<slug>"
  * "https://www.bloomberg.com/news/articles/<slug>"
  Unacceptable: profile pages, homepages, generic search result URLs, or URLs you cannot verify.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Supply Dynamics ────────────────────────────────────────────────────────

const SUPPLY_SYSTEM = `You are a Bitcoin on-chain analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

Search for the latest Bitcoin supply and on-chain data. Return the data in this exact JSON format:

{
  "exchange_reserve_trend": "<string describing exchange reserve trend>",
  "long_term_holder_pct": <number 0-100 or null>,
  "supply_narrative": "<2-3 sentences summarizing supply dynamics for investors>"
}

Rules:
- exchange_reserve_trend: describe the current trend, e.g. "Exchange reserves hit 5-year low at 2.3M BTC, declining for 8 consecutive months"
- long_term_holder_pct: percentage of BTC supply held for >1 year. null if unavailable.
- supply_narrative: write for sophisticated investors who understand supply/demand dynamics
- Use real data from sources like Glassnode, CryptoQuant, or similar. Do not fabricate.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Task ───────────────────────────────────────────────────────────────────

interface EnrichmentPayload {
  top_stories: TopStory[];
  all_articles: RawArticle[];
  market_summary: string | null;
  briefing_summary: {
    one_line: string;
    macro_narrative: string;
    technical_summary: string;
    narrative_label: string;
    narrative_score: number;
  } | null;
}

interface EnrichmentOutput {
  looking_ahead: string;
  institutional_flows: InstitutionalFlows;
  supply_dynamics: SupplyDynamics;
  expert_insights: ExpertInsight[];
}

const DEFAULTS: EnrichmentOutput = {
  looking_ahead: "Forward-looking analysis unavailable today.",
  institutional_flows: {
    summary: "Data unavailable",
    notable_moves: [],
  },
  supply_dynamics: {
    exchange_reserve_trend: "Data unavailable",
    long_term_holder_pct: null,
    supply_narrative: "Supply data unavailable today.",
  },
  expert_insights: [],
};

export const enrichmentTask = task({
  id: "enrichment",
  run: async (payload: EnrichmentPayload): Promise<EnrichmentOutput> => {
    const { top_stories, all_articles, market_summary, briefing_summary } = payload;
    logger.info("Starting enrichment", {
      storyCount: top_stories.length,
      articleCount: all_articles.length,
    });

    const output: EnrichmentOutput = { ...DEFAULTS };

    // Fetch forward-looking context from SearchAPI (1 query, non-fatal)
    let forwardHeadlines: string[] = [];
    try {
      const fwdResult = await fetchForwardLookingContext();
      if (fwdResult.data) forwardHeadlines = fwdResult.data;
    } catch {
      logger.warn("Forward-looking SearchAPI scrape failed — continuing without");
    }

    const lookingAheadCtx: LookingAheadContext = {
      top_stories,
      all_articles,
      forward_headlines: forwardHeadlines,
      market_summary,
      briefing_summary,
    };

    // Run all Perplexity queries in parallel (non-fatal individually)
    const [lookingAheadResult, flowsResult, expertsResult, supplyResult] =
      await Promise.allSettled([
        queryPerplexity({
          system: LOOKING_AHEAD_SYSTEM,
          prompt: buildLookingAheadPrompt(lookingAheadCtx),
        }),
        queryPerplexity({
          system: FLOWS_SYSTEM,
          prompt: "What are the most notable non-ETF institutional Bitcoin moves in the last 7 days? Focus on corporate treasury purchases (MicroStrategy, Metaplanet, etc.), large whale wallet movements, fund allocation changes, OTC desk activity, and mining company treasury decisions. Do NOT include ETF flow data.",
        }),
        queryPerplexity({
          system: EXPERTS_SYSTEM,
          prompt: "What are the 3 most impactful and substantive things said about Bitcoin in the last 7 days by people deeply in the Bitcoin space? Search across all sources: Substack newsletters (Lyn Alden, Dylan LeClair, Luke Gromen, Jeff Park, Willy Woo, James Check, etc.), YouTube interviews, podcasts, TV appearances, X posts, and conference talks. Prioritize depth of insight over fame of the speaker. Include well-known figures like Saylor or Cathie Wood only if their commentary was genuinely substantive, not just a retweet or generic bullishness.",
        }),
        queryPerplexity({
          system: SUPPLY_SYSTEM,
          prompt: "What are the latest Bitcoin on-chain supply metrics? Include exchange reserves, long-term holder percentage, and any notable supply dynamics.",
        }),
      ]);

    // ── Looking ahead ─────────────────────────────────────────────────────
    if (lookingAheadResult.status === "fulfilled" && !lookingAheadResult.value.error) {
      let text = lookingAheadResult.value.data?.trim();
      if (text) {
        // Detect and reject self-referential meta-commentary from the model
        const metaPatterns = [
          /\bmy instructions\b/i,
          /\bcritical constraint\b/i,
          /\bthis section\b/i,
          /\blet me deliver\b/i,
          /\bthe briefing you['']ve provided\b/i,
          /\bI appreciate the\b.*\bbriefing\b/i,
          /\bI need to flag\b/i,
          /\bplain text format\b/i,
          /\bthree.paragraph editorial\b/i,
        ];
        const isMeta = metaPatterns.some((p) => p.test(text!));
        if (isMeta) {
          // Try to salvage: find where actual analysis starts (after meta-commentary)
          const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
          const analysisStart = paragraphs.findIndex(
            (p) => !metaPatterns.some((pat) => pat.test(p))
          );
          if (analysisStart >= 0 && paragraphs.length - analysisStart >= 2) {
            text = paragraphs.slice(analysisStart).join("\n\n");
            logger.warn("Stripped meta-commentary from looking ahead output", {
              strippedParagraphs: analysisStart,
            });
          } else {
            logger.warn("Looking ahead output was entirely meta-commentary, discarding");
            text = undefined;
          }
        }
        if (text) {
          output.looking_ahead = text;
          logger.info("Looking ahead complete", { length: text.length });
        }
      }
    } else {
      logger.warn("Looking ahead failed");
    }

    // ── Institutional flows ───────────────────────────────────────────────
    // Zero-hallucination gate: every notable_move MUST have a valid source_url.
    // Strings-without-urls (legacy shape) are dropped on NEW writes so the UI
    // never renders an unverified institutional claim. Empty notable_moves
    // array is the correct output when Perplexity cannot produce verifiable
    // URLs — the homepage renders an empty-state stub instead of fabrication.
    if (flowsResult.status === "fulfilled" && !flowsResult.value.error) {
      try {
        const raw = flowsResult.value.data?.trim() ?? "";
        const cleaned = raw
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .replace(/\[\d+\]/g, "") // strip Perplexity citation markers
          .trim();
        const parsedRaw = JSON.parse(cleaned) as {
          summary?: unknown;
          notable_moves?: unknown;
        };
        const summary = typeof parsedRaw.summary === "string" ? parsedRaw.summary : "Data unavailable";
        const movesRaw = Array.isArray(parsedRaw.notable_moves) ? parsedRaw.notable_moves : [];
        const isValidUrl = (u: unknown): u is string => {
          if (typeof u !== "string") return false;
          try {
            const parsed = new URL(u);
            return parsed.protocol === "https:" || parsed.protocol === "http:";
          } catch {
            return false;
          }
        };
        const verifiedMoves = movesRaw
          .map((m: unknown) => {
            if (typeof m === "string") {
              // Legacy string format has no URL, drop it under the new rule.
              return null;
            }
            if (m && typeof m === "object") {
              const mObj = m as { text?: unknown; source_url?: unknown };
              const text = typeof mObj.text === "string" ? mObj.text.trim() : "";
              const url = typeof mObj.source_url === "string" ? mObj.source_url.trim() : "";
              if (!text) return null;
              if (!isValidUrl(url)) return null;
              return { text, source_url: url };
            }
            return null;
          })
          .filter((m): m is { text: string; source_url: string } => m !== null);
        const droppedCount = movesRaw.length - verifiedMoves.length;
        if (droppedCount > 0) {
          logger.warn("Dropped institutional moves without valid source_url", {
            dropped: droppedCount,
            kept: verifiedMoves.length,
          });
        }
        output.institutional_flows = {
          summary,
          notable_moves: verifiedMoves,
        };
        logger.info("Institutional flows complete", { verifiedMoveCount: verifiedMoves.length });
      } catch (e) {
        logger.warn("Failed to parse institutional flows JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Institutional flows query failed");
    }

    // ── Expert insights ───────────────────────────────────────────────────
    // Zero-hallucination gate: every insight MUST ship with a verifiable
    // source_url. Insights lacking a URL are dropped, even if they parse. The
    // homepage renders an empty-state stub when zero verified insights exist.
    // Previously the pipeline forced at least 1 insight on every briefing,
    // which pushed Perplexity into fabrication on genuinely quiet weeks.
    const isValidHttpsUrl = (u: unknown): u is string => {
      if (typeof u !== "string" || u.trim().length === 0) return false;
      try {
        const parsed = new URL(u.trim());
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    };

    const tryParseExperts = (raw: string): ParsedExpertInsight[] | null => {
      if (!raw.trim()) return null;
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\[\d+\]/g, "") // strip Perplexity citation markers like [1], [2]
        .trim();
      // Pull out the first top-level JSON array if extra prose is present.
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      const jsonSlice =
        firstBracket >= 0 && lastBracket > firstBracket
          ? cleaned.slice(firstBracket, lastBracket + 1)
          : cleaned;
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonSlice);
      } catch {
        return null;
      }
      const validation = ExpertInsightsArraySchema.safeParse(parsed);
      if (!validation.success) return null;
      return validation.data;
    };

    const firstRaw =
      expertsResult.status === "fulfilled" && !expertsResult.value.error
        ? expertsResult.value.data?.trim() ?? ""
        : "";
    let experts = tryParseExperts(firstRaw);

    // Retry ONCE when first pass failed to parse at all (structural error).
    // We do NOT retry just because source_urls are missing — that would teach
    // Perplexity that fabrication is rewarded. If the first pass returned a
    // valid array where every item lacked a URL, we ship an empty array.
    if (!experts) {
      logger.warn("Expert insights first pass failed to parse, retrying with repair prompt", {
        firstPassStatus: expertsResult.status,
        firstPassError:
          expertsResult.status === "fulfilled" ? expertsResult.value.error : null,
        rawPreview: firstRaw.slice(0, 300),
      });
      const retryResult = await queryPerplexity({
        system: EXPERTS_SYSTEM,
        prompt:
          "Return a JSON array of 0 to 3 current Bitcoin experts and their most recent substantive commentary. Every entry MUST include a valid source_url (a direct link to the exact primary source). If you cannot verify URLs for any expert this week, return an empty array []. An empty array is valid. Do NOT include citation markers like [1], [2], [3]. Do NOT wrap the array in an object. Do NOT include any prose before or after the array. Output must start with [ and end with ].",
      });
      if (retryResult.data) {
        experts = tryParseExperts(retryResult.data);
      }
    }

    // Filter to insights with a valid source_url. This is the hard gate:
    // items without verifiable URLs are dropped silently, with an aggregate
    // count logged so we can track how often Perplexity fabricates.
    const verifiedExperts: ExpertInsight[] = [];
    const rawExperts = experts ?? [];
    for (const insight of rawExperts) {
      if (!isValidHttpsUrl(insight.source_url)) {
        continue;
      }
      const handle = insight.twitter_handle ?? undefined;
      verifiedExperts.push({
        expert_name: insight.expert_name,
        role: insight.role,
        quote_or_summary: insight.quote_or_summary,
        source: insight.source,
        source_url: insight.source_url,
        date: insight.date,
        twitter_handle: handle,
        photo_url: getExpertPhotoUrls(insight.expert_name, handle)[0],
      });
    }
    const droppedExpertCount = rawExperts.length - verifiedExperts.length;
    if (droppedExpertCount > 0) {
      logger.warn("Dropped expert insights without valid source_url", {
        dropped: droppedExpertCount,
        kept: verifiedExperts.length,
      });
    }
    output.expert_insights = verifiedExperts;
    if (verifiedExperts.length === 0) {
      logger.warn("Expert insights empty after source_url filter — homepage section will render empty-state", {
        firstPassRawPreview: firstRaw.slice(0, 300),
      });
    } else {
      logger.info("Expert insights complete", { count: verifiedExperts.length });
    }

    // ── Supply dynamics ───────────────────────────────────────────────────
    if (supplyResult.status === "fulfilled" && !supplyResult.value.error) {
      try {
        const raw = supplyResult.value.data?.trim() ?? "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned) as SupplyDynamics;
        output.supply_dynamics = parsed;
        logger.info("Supply dynamics complete");
      } catch (e) {
        logger.warn("Failed to parse supply dynamics JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Supply dynamics query failed");
    }

    logger.info("Enrichment complete", {
      hasLookingAhead: output.looking_ahead !== DEFAULTS.looking_ahead,
      hasFlows: output.institutional_flows !== DEFAULTS.institutional_flows,
      expertCount: output.expert_insights.length,
      hasSupply: output.supply_dynamics !== DEFAULTS.supply_dynamics,
    });

    return output;
  },
});
