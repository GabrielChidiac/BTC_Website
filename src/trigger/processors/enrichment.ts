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

const LOOKING_AHEAD_SYSTEM = `You are a senior macro-financial analyst and Bitcoin strategist writing the flagship forward-looking section for an institutional-grade daily briefing. Your audience is high-net-worth investors, hedge fund managers, and business executives. Use your web search capabilities to find the very latest developments.

This is the most important section of the entire briefing. Be comprehensive and deeply informed.

Guidelines:
- Write 4-5 substantive paragraphs, each covering one clear theme
- Paragraph themes: (1) macro catalysts and central bank policy, (2) regulatory milestones and deadlines, (3) institutional positioning and ETF/corporate treasury signals, (4) technical price levels and what they mean for positioning, (5) on-chain and network signals that sophisticated investors track
- Search the web thoroughly for upcoming events: FOMC meetings, CPI releases, jobs data, central bank decisions, SEC deadlines, congressional hearings, Bitcoin conferences, ETF approval/review dates
- Integrate specific data points (prices, percentages, dates, names, flow numbers) naturally into every paragraph
- Be forward-looking: tell the reader what to WATCH FOR, not just what happened
- Do NOT use markdown formatting. Return plain text only
- Do NOT include citation markers like [1], [2], [3] or any bracketed references. Weave source context naturally into the text (e.g. "according to SEC filings" or "per Bloomberg data")
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead
- No bullet points. Write in flowing editorial prose like the Financial Times or Bloomberg
- Always close the final paragraph on a constructive or long-term bullish note grounded in verifiable data (e.g. institutional inflows, network fundamentals, supply scarcity, adoption milestones). Never fabricate; if the short-term outlook is bearish, anchor the closing in Bitcoin's structural long-term thesis rather than price predictions.`;

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

  parts.push("Based on ALL of this intelligence, write a comprehensive forward-looking analysis for the next 24-72 hours. Cover: (1) macro catalysts and central bank policy implications, (2) regulatory milestones and upcoming deadlines, (3) institutional positioning signals and ETF flow trends, (4) key technical price levels to watch and their significance, (5) on-chain and network signals. Search the web for any additional upcoming events not covered above. This is the flagship section; be thorough and insightful.");

  return parts.join("\n");
}

// ─── Institutional Flows ────────────────────────────────────────────────────

const FLOWS_SYSTEM = `You are a financial data analyst. Return ONLY valid JSON, no markdown fences or extra text.

Search for today's Bitcoin ETF flow data, corporate treasury moves, and institutional buying/selling activity. Return the data in this exact JSON format:

{
  "etf_net_flow_usd": <number or null>,
  "etf_total_aum_usd": <number or null>,
  "etf_flow_trend": "<string describing recent trend>",
  "notable_moves": ["<string>", ...]
}

Rules:
- etf_net_flow_usd: net inflow (positive) or outflow (negative) in USD for today/yesterday. null if unavailable.
- etf_total_aum_usd: total Bitcoin ETF AUM in USD. null if unavailable.
- etf_flow_trend: describe the recent trend, e.g. "5 consecutive days of net inflows totaling $1.2B"
- notable_moves: 2-4 notable institutional moves, e.g. "MicroStrategy purchased 12,000 BTC ($780M)"
- Use real, verified data only. Do not fabricate numbers.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Expert Insights ────────────────────────────────────────────────────────

const EXPERTS_SYSTEM = `You are a financial media analyst. Return ONLY valid JSON, no markdown fences or extra text.

Search for recent notable commentary on Bitcoin from recognized experts and thought leaders, from podcasts, interviews, newsletters, conference talks, or social media. Focus on credible voices that institutional investors would respect.

Return an array in this exact JSON format:
[
  {
    "expert_name": "<full name>",
    "role": "<title/role>",
    "twitter_handle": "<X/Twitter handle without @ symbol, or null if unknown>",
    "quote_or_summary": "<2-3 sentence summary of their key insight>",
    "source": "<where they said it>",
    "date": "<YYYY-MM-DD or approximate>"
  }
]

Rules:
- Include 3-5 experts maximum
- Every entry MUST be a named individual person, never a firm or team (e.g. "Gautam Chhugani" not "Bernstein Analysts")
- Focus on macro analysts, fund managers, CEOs, former regulators. NOT YouTube influencers
- Examples of credible voices: Lyn Alden, Michael Saylor, Cathie Wood, Raoul Pal, Luke Gromen, Larry Fink, Stanley Druckenmiller, Jeff Park, Mark Yusko
- Use real, recent quotes/insights only. Do not fabricate.
- Source should be specific: "The Investors Podcast ep. 423", "Bloomberg interview", "X post", etc.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Supply Dynamics ────────────────────────────────────────────────────────

const SUPPLY_SYSTEM = `You are a Bitcoin on-chain analyst. Return ONLY valid JSON, no markdown fences or extra text.

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
          prompt: "What are today's Bitcoin spot ETF flow numbers and any notable institutional Bitcoin purchases or sales in the last 24-48 hours?",
        }),
        queryPerplexity({
          system: EXPERTS_SYSTEM,
          prompt: "What have notable Bitcoin experts, macro analysts, and institutional investors said about Bitcoin in the last 7 days? Focus on credible voices from podcasts, interviews, newsletters, and conferences.",
        }),
        queryPerplexity({
          system: SUPPLY_SYSTEM,
          prompt: "What are the latest Bitcoin on-chain supply metrics? Include exchange reserves, long-term holder percentage, and any notable supply dynamics.",
        }),
      ]);

    // ── Looking ahead ─────────────────────────────────────────────────────
    if (lookingAheadResult.status === "fulfilled" && !lookingAheadResult.value.error) {
      const text = lookingAheadResult.value.data?.trim();
      if (text) {
        output.looking_ahead = text;
        logger.info("Looking ahead complete", { length: text.length });
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
