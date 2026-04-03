import { task, logger } from "@trigger.dev/sdk/v3";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import { fetchForwardLookingContext } from "@/trigger/lib/searchapi";
import { getExpertPhotoUrls } from "@/lib/expert-photos";
import type {
  TopStory,
  RawArticle,
  InstitutionalFlows,
  SupplyDynamics,
  ExpertInsight,
} from "@/lib/types";

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
- Close on a constructive note grounded in verifiable Bitcoin-specific data (institutional inflows, network fundamentals, supply scarcity). Never fabricate.`;

interface LookingAheadContext {
  top_stories: TopStory[];
  all_articles: RawArticle[];
  forward_headlines: string[];
  market_summary: string | null;
  briefing_summary: EnrichmentPayload["briefing_summary"];
}

function buildLookingAheadPrompt(ctx: LookingAheadContext): string {
  const parts: string[] = [];

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

const FLOWS_SYSTEM = `You are a financial data analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

Search for today's Bitcoin ETF flow data, corporate treasury moves, and institutional buying/selling activity. Return the data in this exact JSON format:

{
  "etf_net_flow_usd": <number or null>,
  "etf_total_aum_usd": <number or null>,
  "etf_flow_trend": "<string describing recent trend>",
  "notable_moves": ["<string>", ...]
}

Rules:
- etf_net_flow_usd: net inflow (positive) or outflow (negative) in USD for today/yesterday. null if unavailable.
- etf_total_aum_usd: total combined AUM (assets under management) across ALL US spot Bitcoin ETFs in USD. This is a critical field. Search for "Bitcoin ETF total AUM", "Bitcoin ETF total net assets", or "Bitcoin ETF assets under management". As of early 2026, this figure is typically in the $80B-$120B range. Return the raw USD number (e.g. 95000000000 for $95B). null ONLY if you truly cannot find any estimate.
- etf_flow_trend: describe the recent trend, e.g. "5 consecutive days of net inflows totaling $1.2B"
- notable_moves: 2-4 notable institutional moves, e.g. "MicroStrategy purchased 12,000 BTC ($780M)"
- Use real, verified data only. Do not fabricate numbers.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Expert Insights ────────────────────────────────────────────────────────

const EXPERTS_SYSTEM = `You are a financial media analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

Search for the most recent notable commentary on Bitcoin from 3 well-known public figures. Search across ALL media formats: YouTube interviews, podcasts, X/Twitter posts, Bloomberg/CNBC TV appearances, conference talks, Substack newsletters, and written commentary. Substack is a HIGH-PRIORITY source; many top analysts publish their best research there (Lyn Alden, Dylan LeClair, Luke Gromen, Jeff Park, etc.). Cast a wide net.

Return an array of EXACTLY 3 experts in this JSON format:
[
  {
    "expert_name": "<full name>",
    "role": "<title/role>",
    "twitter_handle": "<X/Twitter handle without @ symbol, or null if unknown>",
    "quote_or_summary": "<2-3 sentence summary of their most recent key insight about Bitcoin>",
    "source": "<specific source: 'YouTube: What Bitcoin Did ep. 891', 'Bloomberg TV interview Mar 25', 'The Investors Podcast ep. 423', 'X post', etc.>",
    "date": "<YYYY-MM-DD or approximate>"
  }
]

Rules:
- Return EXACTLY 3 experts. No more, no fewer.
- Every expert MUST be someone deeply in the Bitcoin space with real skin in the game: builders, fund managers, on-chain analysts, miners, protocol developers, macro strategists who actively cover BTC, or executives running Bitcoin-focused companies. They do NOT need to be household names or TV personalities. What matters is domain expertise and that their insight is substantive and impactful.
- WELL-KNOWN figures (Michael Saylor, Cathie Wood, Larry Fink, Raoul Pal, Lyn Alden, Stanley Druckenmiller, Jeff Park, Luke Gromen, Matt Hougan, Jan van Eck) are great when they have recent commentary, but do NOT default to them if a lesser-known expert said something more insightful this week.
- ALSO CONSIDER deep Bitcoin analysts and researchers who publish on Substack, podcasts, or X: Dylan LeClair, Willy Woo, James Check (Checkmate), Will Clemente, Sam Callahan, Joe Burnett, Pierre Rochard, Tuur Demeester, Adam Back, Jameson Lopp, Nic Carter, Preston Pysh, Greg Foss, Alex Gladstein, and similar Bitcoin-native voices.
- NEVER include random commentators with no track record in Bitcoin, unnamed analysts, or people who just make price predictions without substance
- Every entry MUST be a named individual person, never a firm or team
- YouTube interviews, podcast appearances, and video content ARE excellent sources. Cite them specifically with episode numbers or dates.
- Substack posts and newsletters ARE excellent sources. Cite them as "Substack: <author name>, '<post title>', <date>".
- Use the most recent commentary available (preferably within the last 7 days)
- Use real, recent quotes/insights only. Do not fabricate.
- Source must be specific and detailed: "YouTube: What Bitcoin Did ep. 891", "The Investors Podcast ep. 423", "Bloomberg TV interview Mar 25", "X post Mar 26", "Substack: Lyn Alden, 'Fiscal Monitor Update', Mar 24", etc.
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
    etf_net_flow_usd: null,
    etf_total_aum_usd: null,
    etf_flow_trend: "Data unavailable",
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
          prompt: "What are today's Bitcoin spot ETF flow numbers, the total combined AUM (assets under management) across all US spot Bitcoin ETFs, and any notable institutional Bitcoin purchases or sales in the last 24-48 hours? Make sure to include the total ETF AUM figure.",
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
    if (flowsResult.status === "fulfilled" && !flowsResult.value.error) {
      try {
        const raw = flowsResult.value.data?.trim() ?? "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned) as InstitutionalFlows;
        output.institutional_flows = parsed;
        logger.info("Institutional flows complete");
      } catch (e) {
        logger.warn("Failed to parse institutional flows JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Institutional flows query failed");
    }

    // ── Expert insights ───────────────────────────────────────────────────
    if (expertsResult.status === "fulfilled" && !expertsResult.value.error) {
      try {
        const raw = expertsResult.value.data?.trim() ?? "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned) as ExpertInsight[];
        if (Array.isArray(parsed)) {
          output.expert_insights = parsed.map((insight) => ({
            ...insight,
            photo_url: getExpertPhotoUrls(
              insight.expert_name,
              insight.twitter_handle,
            )[0],
          }));
          logger.info("Expert insights complete", { count: parsed.length });
        }
      } catch (e) {
        logger.warn("Failed to parse expert insights JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Expert insights query failed");
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
