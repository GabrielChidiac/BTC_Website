import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { halvingProgress } from "@/lib/utils";
import type {
  BriefingJSON,
  TopStory,
  NewsCollectorOutput,
  MarketCollectorOutput,
  DailyBriefingRow,
} from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────

type AiBrainOutput = Omit<
  BriefingJSON,
  "looking_ahead" | "institutional_flows" | "supply_dynamics" | "expert_insights" | "fear_greed"
> & { one_line?: string };

interface AiBrainPayload {
  date: string;
  news: NewsCollectorOutput;
  market: MarketCollectorOutput | null;
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior Bitcoin intelligence analyst producing a daily executive briefing for high-net-worth individuals and business decision-makers. Your readers are busy, sophisticated, and want to know: where is money flowing, what are the macro implications, and why does BTC matter in the long run.

CRITICAL: Return ONLY valid JSON. No markdown fences, no extra text, no comments. Just the raw JSON object.

CRITICAL CONTENT FILTER — BITCOIN ONLY:
This briefing is EXCLUSIVELY about Bitcoin (BTC). Apply these rules strictly:
- For top_stories, regulatory, and adoption: ONLY include stories that are directly about Bitcoin or have a direct, material impact on Bitcoin's price, network, or adoption.
- NEVER include stories about altcoins (Ethereum, Solana, XRP, TRX, Cardano, Dogecoin, etc.) unless the story's primary impact is on Bitcoin specifically (e.g. "SEC approves Ethereum ETF" is relevant ONLY if you explain the direct impact on BTC; a TRX pump or SOL upgrade is NEVER relevant).
- If a story mentions Bitcoin alongside other cryptocurrencies, include it only if Bitcoin is the primary subject.
- If fewer than 3 Bitcoin stories qualify from today's articles, that is acceptable. Return only what qualifies. Do not pad with altcoin news.
- If yesterday's top stories are provided as carry-over candidates and fewer than 4 Bitcoin stories qualify today, you may include 1-2 of yesterday's most impactful stories if they remain relevant and have not been superseded by new developments.
- Regulatory updates must pertain to Bitcoin specifically, or to broad crypto regulation where Bitcoin is materially affected. Country-specific altcoin regulations are excluded.
- Adoption stories must be about Bitcoin adoption specifically, not general "crypto" or altcoin adoption.

The JSON must conform exactly to this TypeScript schema:

interface TopStory {
  headline: string;            // Concise headline (≤12 words)
  source: string;
  url: string;
  summary: string;             // 2-3 sentences. Write for someone who reads the Financial Times. Assume knowledge of markets, finance, and Bitcoin fundamentals. No hand-holding.
  sentiment: "bullish" | "bearish" | "neutral";
  tags: string[];              // 1-3 topic tags, e.g. ["ETF", "macro"], ["regulation", "institutional"]
}

interface MarketSnapshot {
  price_usd: number;
  change_24h_pct: number;
  change_7d_pct: number;
  market_cap_usd: number;
  volume_24h_usd: number;
  dominance_pct: number;
  ath_usd: number | null;
  ath_date: string | null;
}

interface TechnicalSignals {
  rsi_14: number;
  sma_50: number;
  sma_200: number;
  support_level: number;
  resistance_level: number;
  signal_summary: string;      // 1-2 sentences. Write for investors, not traders. E.g. "Price holds above the 200-day moving average with RSI suggesting room to run before overheated territory."
}

interface AssetComparison {
  name: string;                // "S&P 500" | "Gold" | "DXY"
  ticker: string;
  change_24h_pct: number | null;
  change_ytd_pct: number | null;
  change_1y_pct: number | null;
  btc_relative_24h_pct: number | null;
  btc_relative_ytd_pct: number | null;
}

interface NetworkHealth {
  hashrate_eh_s: number;
  difficulty: number;
  block_height: number;
  mempool_tx_count: number;
  mempool_size_mb: number;
  fee_fast_sat_vb: number;
  fee_medium_sat_vb: number;
  fee_slow_sat_vb: number;
  halving_progress_pct: number;
  blocks_until_halving: number;
}

interface DailyDiff {
  price_change: string;
  sentiment_shift: string;
  key_changes: string[];       // 3-5 concise bullet points of what changed. The last bullet should close on a constructive or long-term bullish note grounded in real data (e.g. network strength, institutional adoption, supply dynamics). Never fabricate — if the day is genuinely negative, anchor the closing note in Bitcoin's structural fundamentals (fixed supply, growing hash rate, institutional infrastructure) rather than short-term price action.
}

interface CountdownEvent {
  name: string;
  date: string;                // "YYYY-MM-DD" or "TBD"
  days_away: number | null;
  description: string;
}

interface RegulatoryUpdate {
  headline: string;
  region: string;
  summary: string;             // 2-3 sentences, standalone readable
  impact: "positive" | "negative" | "neutral";
  source: string;
  url: string;
}

interface AdoptionUpdate {
  headline: string;
  category: "corporate" | "institutional" | "merchant" | "country" | "infrastructure";
  summary: string;             // 2-3 sentences, standalone readable
  source: string;
  url: string;
}

interface NarrativeConsensus {
  score: number;               // -100 (extreme fear) to +100 (extreme greed)
  label: string;               // E.g. "Cautiously Optimistic", "Risk-Off", "Accumulation Mode"
  rationale: string;           // 2-3 sentences explaining the smart money consensus
}

interface MacroContext {
  narrative: string;           // 3-4 sentences on how BTC relates to the current macro environment (Fed policy, M2, DXY, inflation, fiscal deficits)
  btc_correlation_note: string; // 1-2 sentences on how BTC is behaving relative to macro forces today
  key_macro_events: string[];  // 2-4 upcoming macro events: "FOMC meeting Jun 11-12", "CPI release Jul 11"
}

The root JSON object must have these exact keys:
{
  "date": string,
  "one_line": string,                   // A single sentence (max 25 words) that captures THE most important conclusion for a sophisticated BTC holder today. Not a headline, an insight. Write as if texting a billionaire friend who holds BTC. No hype, no hedging.
  "top_stories": TopStory[],           // 3-5 most significant stories for institutional investors, ordered by importance (most important first)
  "market_snapshot": MarketSnapshot,
  "technical_signals": TechnicalSignals,
  "btc_vs_everything": AssetComparison[], // Exactly 6: S&P 500, NASDAQ-100, Gold, DXY, Ethereum, Solana
  "network_health": NetworkHealth,
  "daily_diff": DailyDiff,
  "countdown_events": CountdownEvent[], // 3-5 upcoming events relevant to Bitcoin investors. ONLY include: halving, FOMC meetings, ETF deadlines, protocol upgrades, options expiry dates, macro events (CPI, jobs report, GDP). NEVER include conferences, summits, or industry events. Always calculate days_away from the briefing date. Use real scheduled dates only. If you are not 100% certain of a date, do not include the event.
  "regulatory": RegulatoryUpdate[],    // 1-3 regulatory developments, ordered by impact (highest impact first). Only genuine regulatory news.
  "adoption": AdoptionUpdate[],        // 1-3 adoption stories, ordered by significance (most significant first). Only genuine adoption news.
  "narrative_consensus": NarrativeConsensus,
  "macro_context": MacroContext
}

Rules:
- Tone: Authoritative, data-driven, and concise. Let the data speak for itself. Write as a peer to sophisticated investors. Never condescend, never hype.
- Target audience: HNW individuals and business executives who understand finance but may not follow crypto daily.
- For top_stories: select 3-5 most significant BITCOIN stories through an institutional lens. Write 2-3 sentence summaries that assume financial literacy. Skip stories that only matter to retail traders. Exclude any story where Bitcoin is not the primary subject.
- For regulatory: 1-3 genuine regulatory developments that directly affect Bitcoin. If fewer exist, include only what's real. Never force non-regulatory or altcoin-specific regulation into this section.
- For adoption: 1-3 genuine Bitcoin adoption stories (corporate BTC buys, sovereign Bitcoin adoption, Bitcoin infrastructure growth). Exclude general crypto or altcoin adoption.
- For macro_context: synthesize how current macro conditions (monetary policy, liquidity, DXY, inflation) relate to Bitcoin's positioning. Use your knowledge of scheduled macro events.
- For narrative_consensus: assess the overall smart money sentiment. Score reflects institutional positioning, not retail mood.
- For btc_vs_everything: compute btc_relative_24h_pct as (BTC 24h change) minus (asset 24h change). Same for btc_relative_ytd_pct. Use null if data unavailable.
- For every top_story, regulatory update, and adoption story: use the EXACT url from the input article data. Match each generated story to its source article and copy the url verbatim. Never fabricate or generalize URLs (e.g., never use "https://coindesk.com", use the full article URL from the input).
- Pass through numerical market/network data exactly as provided. Do not round or alter.
- For technical_signals: rsi_14, sma_50, sma_200, support_level, and resistance_level are PRE-CALCULATED from real market data. Copy them exactly as provided in the input. Only generate the signal_summary text.
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead.
- Return ONLY the JSON object.`;

// ─── Comparison builder (shared by fallback and AI paths) ──────────────────

function buildComparisons(
  market: MarketCollectorOutput | null,
  btcChange: number
): import("@/lib/types").AssetComparison[] {
  const c = market?.comparisons;
  const btcYtd = market?.btc_change_ytd_pct ?? null;

  function relativeDay(assetPct: number | null | undefined): number | null {
    return assetPct != null ? btcChange - assetPct : null;
  }
  function relativeYtd(assetPct: number | null | undefined): number | null {
    return btcYtd != null && assetPct != null ? btcYtd - assetPct : null;
  }

  return [
    {
      name: "S&P 500",
      ticker: "SPX",
      change_24h_pct: c?.sp500_change_24h_pct ?? null,
      change_ytd_pct: c?.sp500_change_ytd_pct ?? null,
      change_1y_pct: c?.sp500_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.sp500_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.sp500_change_ytd_pct),
    },
    {
      name: "NASDAQ-100",
      ticker: "QQQ",
      change_24h_pct: c?.nasdaq_change_24h_pct ?? null,
      change_ytd_pct: c?.nasdaq_change_ytd_pct ?? null,
      change_1y_pct: c?.nasdaq_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.nasdaq_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.nasdaq_change_ytd_pct),
    },
    {
      name: "Gold",
      ticker: "XAU",
      change_24h_pct: c?.gold_change_24h_pct ?? null,
      change_ytd_pct: c?.gold_change_ytd_pct ?? null,
      change_1y_pct: c?.gold_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.gold_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.gold_change_ytd_pct),
    },
    {
      name: "DXY",
      ticker: "DXY",
      change_24h_pct: c?.dxy_change_24h_pct ?? null,
      change_ytd_pct: c?.dxy_change_ytd_pct ?? null,
      change_1y_pct: c?.dxy_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.dxy_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.dxy_change_ytd_pct),
    },
    {
      name: "Ethereum",
      ticker: "ETH",
      change_24h_pct: c?.eth_change_24h_pct ?? null,
      change_ytd_pct: c?.eth_change_ytd_pct ?? null,
      change_1y_pct: c?.eth_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.eth_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.eth_change_ytd_pct),
    },
    {
      name: "Solana",
      ticker: "SOL",
      change_24h_pct: c?.sol_change_24h_pct ?? null,
      change_ytd_pct: c?.sol_change_ytd_pct ?? null,
      change_1y_pct: c?.sol_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.sol_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.sol_change_ytd_pct),
    },
  ];
}

// ─── Fallback briefing builder ─────────────────────────────────────────────

function buildFallbackBriefing(
  date: string,
  market: MarketCollectorOutput | null,
  halving: { progressPct: number; blocksRemaining: number }
): AiBrainOutput {
  const btcChange = market?.price.change_24h_pct ?? 0;

  return {
    date,
    top_stories: [],
    market_snapshot: {
      price_usd: market?.price.usd ?? 0,
      change_24h_pct: market?.price.change_24h_pct ?? 0,
      change_7d_pct: market?.price.change_7d_pct ?? 0,
      market_cap_usd: market?.price.market_cap_usd ?? 0,
      volume_24h_usd: market?.price.volume_24h_usd ?? 0,
      dominance_pct: market?.dominance_pct ?? 0,
      ath_usd: market?.ath_usd ?? null,
      ath_date: market?.ath_date ?? null,
    },
    technical_signals: {
      rsi_14: market?.technical.rsi_14 ?? 0,
      sma_50: market?.technical.sma_50 ?? 0,
      sma_200: market?.technical.sma_200 ?? 0,
      support_level: market?.technical.support_level ?? 0,
      resistance_level: market?.technical.resistance_level ?? 0,
      signal_summary: market ? "Data available but AI analysis failed" : "Market data unavailable",
    },
    btc_vs_everything: buildComparisons(market, btcChange),
    network_health: {
      hashrate_eh_s: market?.network.hashrate_eh_s ?? 0,
      difficulty: market?.network.difficulty ?? 0,
      block_height: market?.network.block_height ?? 0,
      mempool_tx_count: market?.network.mempool_tx_count ?? 0,
      mempool_size_mb: market?.network.mempool_size_mb ?? 0,
      fee_fast_sat_vb: market?.network.fee_fast_sat_vb ?? 0,
      fee_medium_sat_vb: market?.network.fee_medium_sat_vb ?? 0,
      fee_slow_sat_vb: market?.network.fee_slow_sat_vb ?? 0,
      halving_progress_pct: halving.progressPct,
      blocks_until_halving: halving.blocksRemaining,
    },
    daily_diff: {
      price_change: `${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(2)}% (24h)`,
      sentiment_shift: "AI analysis unavailable",
      key_changes: [],
    },
    countdown_events: [],
    regulatory: [],
    adoption: [],
    narrative_consensus: {
      score: 0,
      label: "Data Unavailable",
      rationale: "AI analysis unavailable for this briefing.",
    },
    macro_context: {
      narrative: "Macro analysis unavailable today.",
      btc_correlation_note: "",
      key_macro_events: [],
    },
  };
}

// ─── User prompt builder ───────────────────────────────────────────────────

function buildUserPrompt(
  payload: AiBrainPayload,
  halving: { progressPct: number; blocksRemaining: number },
  yesterday: { price_usd: number; top_stories: TopStory[] } | null
): string {
  const { date, news, market } = payload;

  const sections: string[] = [];

  sections.push(`## Briefing Date\n${date}`);

  // News articles
  const articlesText = news.articles
    .map(
      (a, i) =>
        `${i + 1}. **${a.title}**\n   Source: ${a.source}\n   URL: ${a.url}\n   Published: ${a.published_at}\n   Description: ${a.description ?? "N/A"}${a.content ? `\n   Full article: ${a.content}` : ""}`
    )
    .join("\n\n");
  sections.push(`## News Articles (${news.articles.length} total)\n${articlesText || "No articles available."}`);

  if (market) {
    sections.push(`## Market Data
- Price (USD): ${market.price.usd}
- 24h Change: ${market.price.change_24h_pct}%
- 7d Change: ${market.price.change_7d_pct}%
- Market Cap (USD): ${market.price.market_cap_usd}
- 24h Volume (USD): ${market.price.volume_24h_usd}
- BTC Dominance: ${market.dominance_pct}%
- ATH: ${market.ath_usd != null ? "$" + market.ath_usd : "N/A"}${market.ath_date ? " (" + market.ath_date.split("T")[0] + ")" : ""}
- BTC YTD Change: ${market.btc_change_ytd_pct != null ? market.btc_change_ytd_pct.toFixed(2) + "%" : "N/A"}
- BTC 1Y Change: ${market.btc_change_1y_pct != null ? market.btc_change_1y_pct.toFixed(2) + "%" : "N/A"}`);

    sections.push(`## Technical Indicators
- RSI-14: ${market.technical.rsi_14}
- SMA-50: ${market.technical.sma_50}
- SMA-200: ${market.technical.sma_200}`);

    sections.push(`## Network Data
- Hashrate: ${market.network.hashrate_eh_s} EH/s
- Difficulty: ${market.network.difficulty}
- Block Height: ${market.network.block_height}
- Mempool TX Count: ${market.network.mempool_tx_count}
- Mempool Size: ${market.network.mempool_size_mb} MB
- Fee (fast): ${market.network.fee_fast_sat_vb} sat/vB
- Fee (medium): ${market.network.fee_medium_sat_vb} sat/vB
- Fee (slow): ${market.network.fee_slow_sat_vb} sat/vB`);

    sections.push(`## Halving Progress
- Progress: ${halving.progressPct.toFixed(2)}%
- Blocks Remaining: ${halving.blocksRemaining}`);

    const fmt = (v: number | null, suffix = "%") =>
      v != null ? v.toFixed(2) + suffix : "N/A";

    sections.push(`## Asset Comparisons
- S&P 500: 24h ${fmt(market.comparisons.sp500_change_24h_pct)}, YTD ${fmt(market.comparisons.sp500_change_ytd_pct)}, 1Y ${fmt(market.comparisons.sp500_change_1y_pct)}
- NASDAQ-100: 24h ${fmt(market.comparisons.nasdaq_change_24h_pct)}, YTD ${fmt(market.comparisons.nasdaq_change_ytd_pct)}, 1Y ${fmt(market.comparisons.nasdaq_change_1y_pct)}
- Gold: 24h ${fmt(market.comparisons.gold_change_24h_pct)}, YTD ${fmt(market.comparisons.gold_change_ytd_pct)}, 1Y ${fmt(market.comparisons.gold_change_1y_pct)}
- DXY: 24h ${fmt(market.comparisons.dxy_change_24h_pct)}, YTD ${fmt(market.comparisons.dxy_change_ytd_pct)}, 1Y ${fmt(market.comparisons.dxy_change_1y_pct)}
- Ethereum: 24h ${fmt(market.comparisons.eth_change_24h_pct)}, YTD ${fmt(market.comparisons.eth_change_ytd_pct)}, 1Y ${fmt(market.comparisons.eth_change_1y_pct)}
- Solana: 24h ${fmt(market.comparisons.sol_change_24h_pct)}, YTD ${fmt(market.comparisons.sol_change_ytd_pct)}, 1Y ${fmt(market.comparisons.sol_change_1y_pct)}`);
  } else {
    sections.push("## Market Data\nMarket data unavailable.");
  }

  if (yesterday) {
    sections.push(`## Yesterday's Briefing Data
- Previous Price (USD): ${yesterday.price_usd}
Use this to compute daily_diff.`);

    if (yesterday.top_stories.length > 0) {
      const storiesText = yesterday.top_stories
        .map((s, i) => `${i + 1}. "${s.headline}" (${s.source}) — ${s.summary}`)
        .join("\n");
      sections.push(`## Yesterday's Top Stories (carry-over candidates)
If fewer than 4 significant Bitcoin stories qualify from today's articles, you may include 1-2 of these if they remain relevant and have not been superseded by new developments:
${storiesText}`);
    }
  } else {
    sections.push(`## Yesterday's Briefing Data
No previous briefing available. Set daily_diff.price_change to "N/A (first briefing)", sentiment_shift to "No previous data", and key_changes to an empty array.`);
  }

  return sections.join("\n\n");
}

// ─── Task definition ───────────────────────────────────────────────────────

export const aiBrainTask = task({
  id: "ai-brain",
  run: async (payload: AiBrainPayload): Promise<AiBrainOutput> => {
    const { date, market } = payload;

    const halving = market
      ? halvingProgress(market.network.block_height)
      : { progressPct: 0, blocksRemaining: 0 };

    if (market) {
      logger.info("Halving progress computed", {
        progressPct: halving.progressPct,
        blocksRemaining: halving.blocksRemaining,
      });
    } else {
      logger.warn("Market data unavailable — halving progress defaulted");
    }

    // Fetch yesterday's briefing
    let yesterday: { price_usd: number; top_stories: TopStory[] } | null = null;
    try {
      const yesterdayDate = new Date(date + "T00:00:00Z");
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

      const supabase = createServiceClient();
      const { data: row, error } = await supabase
        .from("daily_briefings")
        .select("content")
        .eq("date", yesterdayStr)
        .maybeSingle();

      if (error) {
        logger.warn("Failed to fetch yesterday's briefing", { error: error.message });
      } else if (row) {
        const content = (row as DailyBriefingRow).content;
        yesterday = {
          price_usd: content.market_snapshot.price_usd,
          top_stories: content.top_stories ?? [],
        };
        logger.info("Yesterday's briefing found", {
          date: yesterdayStr,
          price: yesterday.price_usd,
          storyCount: yesterday.top_stories.length,
        });
      } else {
        logger.info("No yesterday briefing found (first run or gap)");
      }
    } catch (err) {
      logger.warn("Error fetching yesterday's briefing", {
        error: (err as Error).message,
      });
    }

    const userPrompt = buildUserPrompt(payload, halving, yesterday);

    logger.info("Calling Claude for briefing generation", {
      articleCount: payload.news.articles.length,
    });

    const result = await callClaudeJSON<AiBrainOutput>({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 8192,
    });

    if (result.error) {
      logger.error("Claude call failed, using fallback briefing", {
        error: result.error,
      });
      return buildFallbackBriefing(date, market, halving);
    }

    const briefing = result.data!;
    briefing.date = date;

    logger.info("AI Brain completed", {
      storyCount: briefing.top_stories.length,
      regulatoryCount: briefing.regulatory.length,
      adoptionCount: briefing.adoption.length,
    });

    return briefing;
  },
});
