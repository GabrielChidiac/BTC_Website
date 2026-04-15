import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { halvingProgress } from "@/lib/utils";
import { dedupeBriefingStories } from "@/lib/dedupe-stories";
import type {
  BriefingJSON,
  TopStory,
  TriageItem,
  NewsCollectorOutput,
  MarketCollectorOutput,
  DailyBriefingRow,
} from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────

type AiBrainOutput = Omit<
  BriefingJSON,
  "looking_ahead" | "institutional_flows" | "supply_dynamics" | "expert_insights" | "etf_flows"
> & { one_line?: string };

interface AiBrainPayload {
  date: string;
  news: NewsCollectorOutput;
  market: MarketCollectorOutput | null;
  triageContext?: TriageItem[];
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior Bitcoin intelligence analyst producing a daily briefing for busy BTC holders who have jobs. Your readers are doctors, lawyers, founders, engineers, corporate managers, and wealth advisors who own Bitcoin as part of a diversified portfolio. They are sophisticated about markets but not crypto-native. They have 3 to 5 minutes, not 30, and they want confidence they are not missing anything important. Tell them where money is flowing, what the macro implications are, and what they should know so they can focus on their real jobs.

CRITICAL: Return ONLY valid JSON. No markdown fences, no extra text, no comments. Just the raw JSON object.

CRITICAL: All text fields in the JSON must contain only the requested analysis content. NEVER include meta-commentary, remarks about your instructions, disclaimers about your role, or self-referential statements like "I appreciate the data" or "my instructions say." You are invisible; only the analysis exists. Write every text field as if it will be published directly to institutional investors.

CRITICAL CONTENT FILTER — BITCOIN ONLY:
This briefing is EXCLUSIVELY about Bitcoin (BTC). Apply these rules with zero tolerance:
- For top_stories, regulatory, and adoption: ONLY include stories that are directly about Bitcoin or have a direct, material impact on Bitcoin's price, network, or adoption.
- NEVER include stories about: altcoins (Ethereum, Solana, XRP, TRX, Cardano, Dogecoin), , , DeFi protocols, or any non-Bitcoin crypto project. Keep stories from stablecoins (USDC, USDT, Tether, Circle) and prediction markets (Polymarket, Kalshi) which are related to Bitcoin.
- Stories about "crypto regulation" or "crypto adoption" do NOT qualify unless Bitcoin is explicitly named as the primary subject.
- Include stories related to Bitcoin being used as ‘money’ like for example the lighteing network total transactions evolutions or other related matters to Bitcoin transactions and transfer of money.
 
- Custody services for non-Bitcoin assets (e.g. "Anchorage adds Tron custody") are NEVER relevant.
- Stablecoin legislation, prediction market regulations, and general crypto frameworks are NOT Bitcoin stories.
- Include stories related to Bitcoin ETFs and Large Companies, Institutions, Pension Funds, Central Banks investing in Bitcoin, Bitcoin ETFS.
- If a story mentions Bitcoin alongside other cryptocurrencies, include it if Bitcoin is the primary subject and the headline could stand with just "Bitcoin" in it.
- If fewer than 3 Bitcoin stories qualify from today's articles, that is acceptable. Return only what qualifies. Do not pad with non-Bitcoin content. Quality over quantity.
- If yesterday's top stories are provided as carry-over candidates and fewer than 4 Bitcoin stories qualify today, you may include 1-2 of yesterday's most impactful stories if they remain relevant and have not been superseded by new developments, but the focus still remains as many possible Bitcoin stories of today.
- Regulatory updates must be about Bitcoin specifically (e.g. Bitcoin ETF approvals, Bitcoin mining regulation, Bitcoin tax laws). General "crypto regulation" does not count.
- Adoption stories must be about Bitcoin adoption specifically (e.g. a company adding BTC to its treasury, a country adopting Bitcoin as legal tender). Not general crypto adoption. If retailers or cities, governments adopt Bitcoin as payment method, you should include this.

The JSON must conform exactly to this TypeScript schema:

interface TopStory {
  headline: string;            // Concise headline (≤12 words)
  source: string;
  url: string;
  summary: string;             // 2-3 sentences. Each must go beyond a headline restatement to explain what the story MEANS for Bitcoin holders. Structure: one sentence of context (what happened), then one or two sentences of implications (the "so what" for capital flows, positioning, macro, or timeline pressure on catalysts). Assume financial literacy, not crypto-native knowledge. The reader should learn something they could not have guessed from the headline alone.
  sentiment: "bullish" | "bearish" | "neutral";
  category: "market" | "regulatory" | "adoption" | "macro" | "technical";  // REQUIRED. Primary theme of the story. See category rules below.
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
  signal_summary: string;      // ONE short sentence, max 15 words. E.g. "Room to run: RSI neutral, price above 50-day but below 200-day."
}

interface AssetComparison {
  name: string;                // "S&P 500" | "Gold" | "DXY"
  ticker: string;
  change_24h_pct: number | null;
  change_ytd_pct: number | null;
  change_1y_pct: number | null;
  btc_relative_24h_pct: number | null;
  btc_relative_ytd_pct: number | null;
  btc_relative_1y_pct: number | null;
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

interface HeroThreeLines {
  move: string;    // MAX 140 characters. ONE sentence. What BTC did in last 24h + single most likely catalyst. Data first, interpretation second. Example: "Bitcoin fell 2.3 percent overnight as the dollar spiked on stronger than expected US jobs data."
  signal: string;  // MAX 140 characters. ONE sentence. INTERPRETATION of the data, not a headline restatement. Tell the reader what the data MEANS. Example: "ETF flows stayed positive despite the drop, the opposite of what panic selling looks like."
  watch: string;   // MAX 140 characters. ONE sentence. Single next catalyst with a specific date or day count. Pick the most important if multiple. Example: "FOMC meeting in 6 days. Rate path is the only thing that matters this week."
}

interface LookingAheadPrediction {
  claim_text: string;                                          // One sentence plain text describing the prediction
  direction: "up" | "down" | "flat";
  metric: "btc_price" | "spx" | "etf_flow_net" | "rate_decision" | "dxy" | "gold";
  target_date: string;                                         // "YYYY-MM-DD", within the next 30 days, when this prediction can be resolved
}

The root JSON object must have these exact keys:
{
  "date": string,
  "one_line": string,                   // A single sentence (max 25 words) that captures THE most important conclusion for a sophisticated BTC holder today. Not a headline, an insight. Write as if texting a billionaire friend who holds BTC. No hype, no hedging.
  "hero_three_lines": HeroThreeLines,  // THE 3-MINUTE CONTRACT HERO. Three self-contained sentences that convey today's entire essence. A reader who ONLY reads these three must walk away with a complete understanding of today.
  "top_stories": TopStory[],           // 3-5 most significant stories for investors, ordered by importance (most important first)
  "market_snapshot": MarketSnapshot,
  "technical_signals": TechnicalSignals,
  "btc_vs_everything": AssetComparison[], // Exactly 6: S&P 500, NASDAQ-100, Gold, DXY, Ethereum, Solana
  "network_health": NetworkHealth,
  "daily_diff": DailyDiff,
  "countdown_events": CountdownEvent[], // 3-5 upcoming events relevant to Bitcoin investors. ONLY include: halving, FOMC meetings, ETF deadlines, protocol upgrades, options expiry dates, macro events (CPI, jobs report, GDP). NEVER include conferences, summits, or industry events. Always calculate days_away from the briefing date. Use real scheduled dates only. If you are not 100% certain of a date, do not include the event.
  "regulatory": RegulatoryUpdate[],    // 1-3 regulatory developments, ordered by impact (highest impact first). ONLY from the input articles. If no input article covers a regulatory development, return an empty array.
  "adoption": AdoptionUpdate[],        // 1-3 adoption stories, ordered by significance (most significant first). ONLY from the input articles. If no input article covers an adoption story, return an empty array.
  "narrative_consensus": NarrativeConsensus,
  "macro_context": MacroContext,
  "looking_ahead_predictions": LookingAheadPrediction[] // 2-3 testable directional predictions drawn from countdown_events and macro_context. Each must have a specific metric and a target_date within 30 days. Not publicly displayed; feeds an internal accuracy tracking system.
}

Rules:
- ABSOLUTE NO-DUPLICATES RULE: Each story (identified by URL or near-identical headline) may appear in EXACTLY ONE of top_stories, regulatory, or adoption. Never list the same story in two sections. Never list the same URL twice within top_stories. If a story could plausibly fit multiple sections, place it in the one where its primary angle is strongest:
  - Place in regulatory when the primary angle is: government action, legislation, enforcement, SEC/CFTC/Fed moves, central bank policy, court rulings, tax changes, or regulator/political personnel with direct authority over Bitcoin.
  - Place in adoption when the primary angle is: corporate treasury BTC purchases, country-level adoption, merchant/payment integration, or custody and infrastructure build-out.
  - Place in top_stories when the primary angle is: market-moving ETF flows, price catalysts, institutional flows, macro developments, protocol or mining news, or any story with broad investor significance that does not clearly belong in regulatory or adoption.
  If a story has BOTH a regulatory/adoption angle AND strong general importance, still pick ONE slot — top_stories if the general market impact is the main point, regulatory/adoption if the policy or adoption angle is the main point. Never compromise by listing it twice.
- Tone: Authoritative, data-driven, and concise. Let the data speak for itself. Write as a peer to a busy professional who already owns Bitcoin. Never condescend, never hype, never use Crypto Twitter voice.
- Target audience: Busy professionals who own Bitcoin and have jobs. Doctors, lawyers, founders, engineers, managers, wealth advisors. Not crypto-native. Not institutional HNW. They understand finance but may not follow crypto daily. They have 3 to 5 minutes, not 30.
- For hero_three_lines: these three sentences are the single most important output of your day. The move, signal, and watch each stand alone as self-contained declarations. Each one strictly under 140 characters. No "read more" hooks, no cliffhangers, no hedging. Signal must be an INTERPRETATION of the data, not a restatement of the headline; go one level deeper than the surface. Watch must name exactly ONE upcoming catalyst with a specific date or day count.
- For looking_ahead_predictions: generate 2 to 3 testable directional predictions drawn from your countdown_events and macro_context. Each prediction must commit to a direction (up, down, or flat) for a specific metric with a specific target_date within the next 30 days. These feed an internal accuracy tracking system and are never publicly shown. Be honest and commit; do not hedge into useless predictions. If an event's target_date is ambiguous, pick the most likely date.
- For top_stories: select 3-5 most significant BITCOIN stories through a professional investor lens. Each summary must do two things: (1) state what happened in ONE sentence of context, (2) tell the reader what it MEANS for Bitcoin holders in one or two sentences, covering capital flows, positioning shifts, macro implications, or timeline pressure on upcoming catalysts. Do NOT write headline restatements. Do NOT stop at describing the news. The reader should learn something they could not have guessed from the headline alone. Skip stories that only matter to retail traders. Exclude any story where Bitcoin is not the primary subject.

  Negative example (what NOT to do): "Japan's GPIF confirmed it will add Bitcoin ETFs to its allocation model. The pension fund holds over 1.5 trillion dollars in assets. The decision follows a multi-year review process." This is pure description, no interpretation, and teaches the reader nothing the headline did not already imply.

  Positive example: "Japan's GPIF, a 1.5 trillion dollar pension fund, confirmed Bitcoin ETF allocation. This is the first G7 sovereign pension to move from studying Bitcoin to committing capital, and the signaling effect on CalPERS and Norway's fund matters more than GPIF's initial position size. Watch for parallel moves from Canadian and Dutch pension boards over the next 90 days." This names the significance, identifies the second-order effect, and tells the reader what to watch next.
- For top_stories.category (REQUIRED on every top story, exactly one of the five values): pick the single theme that best describes the story's primary subject. Do not hedge, do not combine. The reader uses this label to orient instantly, so it must be decisive.
  - "market" — ETF flows and filings, price catalysts, derivatives and options positioning, liquidations, institutional fund moves, exchange activity. Default for most headlines about money flowing into or out of Bitcoin.
  - "regulatory" — government, SEC, CFTC, central bank policy, legislation, enforcement, court rulings, tax changes, regulator or political personnel with direct authority over Bitcoin. Use this when the story is driven by a public-sector actor.
  - "adoption" — corporate treasury BTC purchases, country-level adoption, merchant or payment integration, custody buildouts. Use this when the story is driven by a non-financial entity putting Bitcoin to use.
  - "macro" — Fed rate decisions, CPI or PCE inflation prints, dollar index moves, jobs reports, fiscal or liquidity policy, broader risk-asset rotations. Use this when the story is macroeconomic rather than Bitcoin-specific but has direct BTC implications.
  - "technical" — mining, hashrate, protocol upgrades, halving milestones, Lightning network metrics, on-chain signals. Use this when the story is about the Bitcoin network itself.
- For regulatory: 1-3 genuine regulatory developments that directly affect Bitcoin. Each item MUST be sourced from a specific input article, with its exact URL and source. Do NOT generate regulatory items from your training data or general knowledge. If no input articles contain regulatory news, return an empty array. Never force non-regulatory or altcoin-specific regulation into this section.
- For adoption: 1-3 genuine Bitcoin adoption stories (corporate BTC buys, sovereign Bitcoin adoption, Bitcoin payment adoption, Bitcoin infrastructure growth). Each item MUST be sourced from a specific input article, with its exact URL and source. Do NOT generate adoption items from your training data or general knowledge. If no input articles contain adoption news, return an empty array. Exclude general crypto or altcoin adoption.
- For macro_context: synthesize how current macro conditions (monetary policy, liquidity, DXY, inflation) relate to Bitcoin's positioning. Use your knowledge of scheduled macro events.
- For narrative_consensus: assess the overall smart money sentiment. Score reflects institutional positioning, not retail mood.
- For btc_vs_everything: compute btc_relative_24h_pct as (BTC 24h change) minus (asset 24h change). Same for btc_relative_ytd_pct and btc_relative_1y_pct. Use null if data unavailable.
- CRITICAL: Every top_story, regulatory update, and adoption story MUST correspond to a specific input article. Use the EXACT url and source from that input article. Copy the url verbatim. Never fabricate or generalize URLs (e.g., never use "https://coindesk.com", use the full article URL from the input). If you cannot match an item to a specific input article, do not include it.
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
  const btc1y = market?.btc_change_1y_pct ?? null;

  function relativeDay(assetPct: number | null | undefined): number | null {
    return assetPct != null ? btcChange - assetPct : null;
  }
  function relativeYtd(assetPct: number | null | undefined): number | null {
    return btcYtd != null && assetPct != null ? btcYtd - assetPct : null;
  }
  function relative1y(assetPct: number | null | undefined): number | null {
    return btc1y != null && assetPct != null ? btc1y - assetPct : null;
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
      btc_relative_1y_pct: relative1y(c?.sp500_change_1y_pct),
    },
    {
      name: "NASDAQ-100",
      ticker: "QQQ",
      change_24h_pct: c?.nasdaq_change_24h_pct ?? null,
      change_ytd_pct: c?.nasdaq_change_ytd_pct ?? null,
      change_1y_pct: c?.nasdaq_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.nasdaq_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.nasdaq_change_ytd_pct),
      btc_relative_1y_pct: relative1y(c?.nasdaq_change_1y_pct),
    },
    {
      name: "Gold",
      ticker: "XAU",
      change_24h_pct: c?.gold_change_24h_pct ?? null,
      change_ytd_pct: c?.gold_change_ytd_pct ?? null,
      change_1y_pct: c?.gold_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.gold_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.gold_change_ytd_pct),
      btc_relative_1y_pct: relative1y(c?.gold_change_1y_pct),
    },
    {
      name: "DXY",
      ticker: "DXY",
      change_24h_pct: c?.dxy_change_24h_pct ?? null,
      change_ytd_pct: c?.dxy_change_ytd_pct ?? null,
      change_1y_pct: c?.dxy_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.dxy_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.dxy_change_ytd_pct),
      btc_relative_1y_pct: relative1y(c?.dxy_change_1y_pct),
    },
    {
      name: "Ethereum",
      ticker: "ETH",
      change_24h_pct: c?.eth_change_24h_pct ?? null,
      change_ytd_pct: c?.eth_change_ytd_pct ?? null,
      change_1y_pct: c?.eth_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.eth_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.eth_change_ytd_pct),
      btc_relative_1y_pct: relative1y(c?.eth_change_1y_pct),
    },
    {
      name: "Solana",
      ticker: "SOL",
      change_24h_pct: c?.sol_change_24h_pct ?? null,
      change_ytd_pct: c?.sol_change_ytd_pct ?? null,
      change_1y_pct: c?.sol_change_1y_pct ?? null,
      btc_relative_24h_pct: relativeDay(c?.sol_change_24h_pct),
      btc_relative_ytd_pct: relativeYtd(c?.sol_change_ytd_pct),
      btc_relative_1y_pct: relative1y(c?.sol_change_1y_pct),
    },
  ];
}

// ─── Fallback briefing builder ─────────────────────────────────────────────

function buildFallbackBriefing(
  date: string,
  market: MarketCollectorOutput,
  halving: { progressPct: number; blocksRemaining: number }
): AiBrainOutput {
  const btcChange = market.price.change_24h_pct;

  return {
    date,
    top_stories: [],
    market_snapshot: {
      price_usd: market.price.usd,
      change_24h_pct: market.price.change_24h_pct,
      change_7d_pct: market.price.change_7d_pct,
      market_cap_usd: market.price.market_cap_usd,
      volume_24h_usd: market.price.volume_24h_usd,
      dominance_pct: market.dominance_pct,
      ath_usd: market.ath_usd ?? null,
      ath_date: market.ath_date ?? null,
    },
    technical_signals: {
      rsi_14: market.technical.rsi_14,
      sma_50: market.technical.sma_50,
      sma_200: market.technical.sma_200,
      support_level: market.technical.support_level,
      resistance_level: market.technical.resistance_level,
      signal_summary: "Data available but AI analysis failed",
    },
    btc_vs_everything: buildComparisons(market, btcChange),
    network_health: {
      hashrate_eh_s: market.network.hashrate_eh_s,
      difficulty: market.network.difficulty,
      block_height: market.network.block_height,
      mempool_tx_count: market.network.mempool_tx_count,
      mempool_size_mb: market.network.mempool_size_mb,
      fee_fast_sat_vb: market.network.fee_fast_sat_vb,
      fee_medium_sat_vb: market.network.fee_medium_sat_vb,
      fee_slow_sat_vb: market.network.fee_slow_sat_vb,
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

  // Triage pre-analysis (if available)
  if (payload.triageContext && payload.triageContext.length > 0) {
    const triageText = payload.triageContext
      .slice(0, 15)
      .map(
        (t) =>
          `- (importance: ${t.importance}/10) "${news.articles[t.index]?.title ?? "Unknown"}" [${t.url}]\n  Reasoning: ${t.reasoning}`
      )
      .join("\n");
    sections.push(`## AI Triage Pre-Analysis
The following articles were identified as most important by a preliminary triage pass. Use this as a signal but apply your own judgment. Articles with full text below were scraped based on this ranking.

${triageText}`);
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
      if (!market) {
        // Both Claude and market collector failed — no real data to publish
        throw new Error(`Claude failed and no market data available: ${result.error}`);
      }
      logger.error("Claude call failed, using fallback briefing with real market data", {
        error: result.error,
      });
      return buildFallbackBriefing(date, market, halving);
    }

    const briefing = result.data!;
    briefing.date = date;

    // Always overwrite btc_vs_everything with computed values from real market data
    // (Claude may omit fields like btc_relative_1y_pct)
    if (market) {
      const btcChange = market.price.change_24h_pct;
      briefing.btc_vs_everything = buildComparisons(market, btcChange);
    }

    const deduped = dedupeBriefingStories(briefing);
    const droppedCount =
      (briefing.top_stories.length - deduped.top_stories.length) +
      (briefing.regulatory.length - deduped.regulatory.length) +
      (briefing.adoption.length - deduped.adoption.length);
    if (droppedCount > 0) {
      logger.warn("Dedup removed duplicate stories from AI Brain output", {
        dropped: droppedCount,
        topStoriesBefore: briefing.top_stories.length,
        topStoriesAfter: deduped.top_stories.length,
        regulatoryBefore: briefing.regulatory.length,
        regulatoryAfter: deduped.regulatory.length,
        adoptionBefore: briefing.adoption.length,
        adoptionAfter: deduped.adoption.length,
      });
    }

    logger.info("AI Brain completed", {
      storyCount: deduped.top_stories.length,
      regulatoryCount: deduped.regulatory.length,
      adoptionCount: deduped.adoption.length,
    });

    return deduped;
  },
});
