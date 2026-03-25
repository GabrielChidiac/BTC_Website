import { task, logger } from "@trigger.dev/sdk/v3";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import type {
  TopStory,
  InstitutionalFlows,
  SupplyDynamics,
  ExpertInsight,
} from "@/lib/types";

// ─── Looking Ahead ──────────────────────────────────────────────────────────

const LOOKING_AHEAD_SYSTEM = `You are a senior macro-financial analyst writing for high-net-worth investors and business executives. Use your web search capabilities to find the latest developments.

Guidelines:
- Focus on macro catalysts, regulatory milestones, and institutional movements for the next 24-72 hours
- Write 2-3 concise paragraphs. Data-driven, no hype
- Assume the reader understands finance and markets. Speak peer-to-peer
- Do NOT use markdown formatting. Return plain text only
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead`;

function buildLookingAheadPrompt(stories: TopStory[]): string {
  if (stories.length === 0) {
    return "What are the key macro and institutional catalysts Bitcoin investors should watch for in the next 24-72 hours?";
  }

  const storyLines = stories
    .map((s, i) => `${i + 1}. "${s.headline}" (${s.source})\n   ${s.summary}`)
    .join("\n\n");

  return `Here are today's top Bitcoin stories:\n\n${storyLines}\n\nBased on these developments, what should sophisticated investors watch for in the next 24-72 hours? Focus on macro implications, regulatory catalysts, and institutional positioning.`;
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
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Expert Insights ────────────────────────────────────────────────────────

const EXPERTS_SYSTEM = `You are a financial media analyst. Return ONLY valid JSON, no markdown fences or extra text.

Search for recent notable commentary on Bitcoin from recognized experts and thought leaders, from podcasts, interviews, newsletters, conference talks, or social media. Focus on credible voices that institutional investors would respect.

Return an array in this exact JSON format:
[
  {
    "expert_name": "<full name>",
    "role": "<title/role>",
    "quote_or_summary": "<2-3 sentence summary of their key insight>",
    "source": "<where they said it>",
    "date": "<YYYY-MM-DD or approximate>"
  }
]

Rules:
- Include 3-5 experts maximum
- Focus on macro analysts, fund managers, CEOs, former regulators. NOT YouTube influencers
- Examples of credible voices: Lyn Alden, Michael Saylor, Cathie Wood, Raoul Pal, Luke Gromen, Larry Fink, Stanley Druckenmiller, Jeff Park, Mark Yusko
- Use real, recent quotes/insights only. Do not fabricate.
- Source should be specific: "The Investors Podcast ep. 423", "Bloomberg interview", "X post", etc.
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
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Task ───────────────────────────────────────────────────────────────────

interface EnrichmentPayload {
  top_stories: TopStory[];
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
    const { top_stories } = payload;
    logger.info("Starting enrichment", { storyCount: top_stories.length });

    const output: EnrichmentOutput = { ...DEFAULTS };

    // Run all Perplexity queries in parallel (non-fatal individually)
    const [lookingAheadResult, flowsResult, expertsResult, supplyResult] =
      await Promise.allSettled([
        queryPerplexity({
          system: LOOKING_AHEAD_SYSTEM,
          prompt: buildLookingAheadPrompt(top_stories),
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
          output.expert_insights = parsed;
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
