import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { halvingProgress } from "@/lib/utils";
import { dedupeBriefingStories } from "@/lib/dedupe-stories";
import { EXPERT_CONTEXT } from "@/trigger/processors/expert-context";
import { AiBrainOutputSchema } from "@/lib/schemas";
import type {
  BriefingJSON,
  TopStory,
  TriageItem,
  DayClassification,
  NewsCollectorOutput,
  MarketCollectorOutput,
  DailyBriefingRow,
} from "@/lib/types";

const EXPERT_CONTEXT_ENABLED = process.env.EXPERT_CONTEXT_ENABLED !== "false";

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
  dayContext?: DayClassification;
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior Bitcoin intelligence analyst producing a daily briefing for busy BTC holders who have jobs. Your readers are doctors, lawyers, founders, engineers, corporate managers, and wealth advisors who own Bitcoin as part of a diversified portfolio. They are sophisticated about markets but not crypto-native. They have 3 to 5 minutes, not 30, and they want confidence they are not missing anything important. Tell them where money is flowing, what the macro implications are, and what they should know so they can focus on their real jobs.

CRITICAL: Return ONLY valid JSON. No markdown fences, no extra text, no comments. Just the raw JSON object.

CRITICAL: All text fields in the JSON must contain only the requested analysis content. NEVER include meta-commentary, remarks about your instructions, disclaimers about your role, or self-referential statements like "I appreciate the data" or "my instructions say." You are invisible; only the analysis exists. Write every text field as if it will be published directly to institutional investors.

═══════════════════════════════════════════════════════════════════════════
NON-NEGOTIABLE READER CONTRACT (most important rule in this prompt)
═══════════════════════════════════════════════════════════════════════════

Every briefing you produce must make these two questions answerable within the first 20 seconds of reading. If the reader cannot answer both after reading hero_three_lines and daily_diff, the briefing has failed.

QUESTION 1: "Is today mostly noise?"
QUESTION 2: "Did anything happen that changes near-term risk?"

How to answer them in the writing:

- daily_diff.sentiment_shift MUST contain an explicit answer in plain English. Examples that pass: "A quiet day. Price drifted inside its 30-day range and no institutional moves cleared the bar." / "Not noise. ETF outflows hit their biggest single day in six weeks, tightening near-term risk." / "Mostly noise with one exception: an SEC enforcement hint worth watching."

- hero_three_lines.signal MUST name whether today mattered or not. "What matters under the noise" is your framing for a quiet day ("Under the surface: nothing structural changed"). On a material day, name the shift directly ("Near-term risk rose today: funding in the 92nd percentile").

- narrative_consensus.rationale should reinforce the verdict, not soften it. Do not write "markets are uncertain" or "mixed signals" as a hedge. If today is noise, say so. If risk is rising, say so.

Soft language that evades the two questions ("there were various developments", "sentiment remained mixed", "the market is watching") is a FAILURE. Be direct about whether the reader should care today.

The DAY CONTEXT block in the user prompt (when present) tells you which answer applies. Align your writing to that classification:
- mostly_noise → both answers are variations of "no" / "nothing structural" / "quiet"
- risk_change → Q2 answer is "yes, here's the risk vector in one sentence"
- thesis_shift → Q1 answer is "no, today was not noise" and Q2 answer explains the structural shift
- mixed → both questions get nuanced answers but still concrete

═══════════════════════════════════════════════════════════════════════════
IMPACT MECHANISM TEST (gate for every item in top_stories + regulatory + adoption)
═══════════════════════════════════════════════════════════════════════════

Before including any item in these three sections, it must pass all three:
1. Direct mechanism — name in one sentence how this story moves BTC price, ETF flows, institutional positioning, Bitcoin network fundamentals, or regulatory authority over BTC. If you cannot, drop it.
2. Historical precedent — would similar events historically have moved BTC >=2% within 7 days, shifted ETF flows >=1σ, or changed positioning (funding, OI, long-term holder supply)? If the honest answer is "no, these usually do nothing," drop it.
3. Bitcoin-primary — is Bitcoin the subject, not an incidental mention? Stories about prediction markets, altcoin exploits, or generic crypto policy that happen to mention BTC should NOT pass this gate.

Specific failures to reject even if they look like big news:
- "X company now holds more BTC than Y" — symbolic rank change without new flow.
- "Nominee supports crypto" in a confirmation hearing — testimony is not action.
- "Analyst predicts $X" or "resistance at $Y" — predictions are not events.
- Lawsuits about prediction markets or altcoin products where BTC is not the regulated subject.
- "Considering" / "evaluating" / "studying" stories.
- Survey results showing future intention to allocate.

A SMALLER set of stories with real mechanisms is always better than a padded set. 2 impact-gated items beat 5 attention-gated items every time. If only 2 items today have a real mechanism, top_stories + regulatory + adoption total 2, not 5.

NUMERIC FLOOR: every included item should normally have been ranked by triage at importance >= 6. Items ranked 5 or below should not appear in top_stories, regulatory, or adoption unless an exception below applies.

EXCEPTIONS (use SPARINGLY, hard cap of 1 per brief total):
You may include a story that fails the mechanism test OR falls below the triage-6 floor ONLY if ONE of these is true AND you explicitly name the exception reason in the story's summary:
1. First-of-kind: no prior comparable event exists. State "first-of-kind" explicitly in the summary.
2. Narrative compound: this story is the 3rd or later item in a weekly pattern pointing the same direction. Name the other 2+ items in the summary.
3. Heavy-day relaxation: if dayContext.depth_weight === "heavy" AND dayContext.confidence >= 0.75, the historical-precedent threshold relaxes from ">=2% in 7 days" to "moved measurably in 30 days". Cite the dayContext in the summary.

HARD CAP: exactly ONE exception per brief. If you want to invoke exceptions on two or more items today, you are padding — today is quieter than you think, and those items don't belong.

═══════════════════════════════════════════════════════════════════════════
COMBINED SECTION CAP (hard rule, no exceptions)
═══════════════════════════════════════════════════════════════════════════

top_stories + regulatory + adoption combined must be 5 items MAXIMUM across the entire briefing. Not five per section. Five total.

Allocate based on importance, not section quotas. Valid distributions:
- 5 stories, 0 regulatory, 0 adoption (pure market day)
- 3 stories, 1 regulatory, 1 adoption (balanced)
- 2 stories, 2 regulatory, 1 adoption (regulation-heavy)
- 1 story, 0 regulatory, 0 adoption (extremely quiet day)
- 4 stories, 0 regulatory, 1 adoption (mostly market, one treasury move)

Never exceed 5 combined. On quiet days it is correct to drop well below 5. Every item in these three sections must clear the score-5 bar from the triage rubric. If only 2 items clear the bar today, the briefing has 2 items. Less is more.

The absolute-no-duplicates rule still applies: each story appears in EXACTLY ONE of the three sections. Never list the same URL or near-identical headline twice.

When deciding which 5 items to keep, rank ALL qualifying items across the three categories together by importance (the triage scores in the user prompt are your primary signal). Take the top 5. Whatever categories they fall into is whatever categories they fall into.

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
  "top_stories": TopStory[],           // Subset of the 5-item combined cap across top_stories + regulatory + adoption. Ordered by importance (most important first). Can be 0 on rare all-regulatory or all-adoption days.
  "market_snapshot": MarketSnapshot,
  "technical_signals": TechnicalSignals,
  "btc_vs_everything": AssetComparison[], // Exactly 6: S&P 500, NASDAQ-100, Gold, DXY, Ethereum, Solana
  "network_health": NetworkHealth,
  "daily_diff": DailyDiff,
  "countdown_events": CountdownEvent[], // 3-5 upcoming events relevant to Bitcoin investors. ONLY include: halving, FOMC meetings, ETF deadlines, protocol upgrades, options expiry dates, macro events (CPI, jobs report, GDP). NEVER include conferences, summits, or industry events. Always calculate days_away from the briefing date. Use real scheduled dates only. If you are not 100% certain of a date, do not include the event.
  "regulatory": RegulatoryUpdate[],    // Subset of the 5-item combined cap. 0-5 regulatory developments by impact. ONLY from the input articles. Often 0 on pure market days.
  "adoption": AdoptionUpdate[],        // Subset of the 5-item combined cap. 0-5 adoption stories by significance. ONLY from the input articles. Often 0 on pure market days.
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
- For top_stories: select up to 5 most significant BITCOIN stories through a professional investor lens, BUT: (a) remember the combined cap: top_stories + regulatory + adoption = 5 items maximum total. If 2 items belong in regulatory and 1 in adoption today, top_stories can only be 2. (b) Every item must pass the IMPACT MECHANISM TEST above. (c) Cross-check against today's actual market data: if today's BTC price barely moved (<1.5% on the day AND inside the 30-day range per market.comparative) AND ETF flows are inside normal range (z-score between -1 and +1), the "market-moving" bar is higher — only include items that you'd flag as market-moving even in hindsight. On such days, fewer stories is correct. Each summary must do two things: (1) state what happened in ONE sentence of context, (2) tell the reader what it MEANS for Bitcoin holders in one or two sentences, covering capital flows, positioning shifts, macro implications, or timeline pressure on upcoming catalysts. Do NOT write headline restatements. Do NOT stop at describing the news. The reader should learn something they could not have guessed from the headline alone. Skip stories that only matter to retail traders. Exclude any story where Bitcoin is not the primary subject.

  Negative example (what NOT to do): "Japan's GPIF confirmed it will add Bitcoin ETFs to its allocation model. The pension fund holds over 1.5 trillion dollars in assets. The decision follows a multi-year review process." This is pure description, no interpretation, and teaches the reader nothing the headline did not already imply.

  Positive example: "Japan's GPIF, a 1.5 trillion dollar pension fund, confirmed Bitcoin ETF allocation. This is the first G7 sovereign pension to move from studying Bitcoin to committing capital, and the signaling effect on CalPERS and Norway's fund matters more than GPIF's initial position size. Watch for parallel moves from Canadian and Dutch pension boards over the next 90 days." This names the significance, identifies the second-order effect, and tells the reader what to watch next.
- For top_stories.category (REQUIRED on every top story, exactly one of the five values): pick the single theme that best describes the story's primary subject. Do not hedge, do not combine. The reader uses this label to orient instantly, so it must be decisive.
  - "market" — ETF flows and filings, price catalysts, derivatives and options positioning, liquidations, institutional fund moves, exchange activity. Default for most headlines about money flowing into or out of Bitcoin.
  - "regulatory" — government, SEC, CFTC, central bank policy, legislation, enforcement, court rulings, tax changes, regulator or political personnel with direct authority over Bitcoin. Use this when the story is driven by a public-sector actor.
  - "adoption" — corporate treasury BTC purchases, country-level adoption, merchant or payment integration, custody buildouts. Use this when the story is driven by a non-financial entity putting Bitcoin to use.
  - "macro" — Fed rate decisions, CPI or PCE inflation prints, dollar index moves, jobs reports, fiscal or liquidity policy, broader risk-asset rotations. Use this when the story is macroeconomic rather than Bitcoin-specific but has direct BTC implications.
  - "technical" — mining, hashrate, protocol upgrades, halving milestones, Lightning network metrics, on-chain signals. Use this when the story is about the Bitcoin network itself.
- For regulatory: 0 to 5 genuine regulatory developments that directly affect Bitcoin, constrained by the combined 5-item cap. Each item MUST be sourced from a specific input article, with its exact URL and source. Do NOT generate regulatory items from your training data or general knowledge. If no input articles contain regulatory news, return an empty array (this is the norm on most days). Never force non-regulatory or altcoin-specific regulation into this section.
- For adoption: 0 to 5 genuine Bitcoin adoption stories (corporate BTC buys, sovereign Bitcoin adoption, Bitcoin payment adoption, Bitcoin infrastructure growth), constrained by the combined 5-item cap. Each item MUST be sourced from a specific input article, with its exact URL and source. Do NOT generate adoption items from your training data or general knowledge. If no input articles contain adoption news, return an empty array. Exclude general crypto or altcoin adoption.
- For macro_context: synthesize how current macro conditions (monetary policy, liquidity, DXY, inflation) relate to Bitcoin's positioning. Use your knowledge of scheduled macro events.
- For narrative_consensus: assess the overall smart money sentiment. Score reflects institutional positioning, not retail mood.
- For btc_vs_everything: compute btc_relative_24h_pct as (BTC 24h change) minus (asset 24h change). Same for btc_relative_ytd_pct and btc_relative_1y_pct. Use null if data unavailable.
- CRITICAL: Every top_story, regulatory update, and adoption story MUST correspond to a specific input article. Use the EXACT url and source from that input article. Copy the url verbatim. Never fabricate or generalize URLs (e.g., never use "https://coindesk.com", use the full article URL from the input). If you cannot match an item to a specific input article, do not include it.
- Pass through numerical market/network data exactly as provided. Do not round or alter.
- For technical_signals: rsi_14, sma_50, sma_200, support_level, and resistance_level are PRE-CALCULATED from real market data. Copy them exactly as provided in the input. Only generate the signal_summary text.
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead.

PRIORITY OVERRIDE RULES (these supersede any conflicting rule above)

EARNED SIGNIFICANCE — analytical framing must be earned by the data, never manufactured. The rules above that ask for a "so what" or interpretive depth apply ONLY when the story genuinely fits an analytical lens (institutional-positioning, macro-regime, historical-rhyme, or long-term-holder-conviction implication) at roughly 90% relevance. When a story does NOT genuinely fit a lens:
- Write a clean 1-2 sentence factual summary and stop. Do not stretch. Do not invent relevance. Do not reach for a lens because the schema suggests one.
- Flat stories should read flat. Concentrate analytical depth on the 1-2 stories per day that genuinely warrant it. A briefing with 2 deep stories and 3 plain summaries is sharper than a briefing where all 5 force analytical framing.
- This rule overrides the positive example above. The positive example demonstrates what depth looks like when it is earned, not a template to apply to every story.

FLAT-DAY PERMISSION — when the day's data genuinely lacks signal, report that honestly instead of manufacturing one:
- narrative_consensus: if no clear smart-money consensus exists today, set score to 0 and label to "Mixed / No Clear Signal" with rationale "Positioning is mixed today with no dominant institutional lean." Do NOT force a score toward the extremes to create apparent conviction.
- macro_context.btc_correlation_note: if BTC is not meaningfully correlating with or decoupling from macro forces today in a way worth flagging, keep this field to a short factual note (e.g., "BTC tracking risk assets in line with recent regime, no notable decoupling today"). Do NOT fabricate a correlation story.
- daily_diff.key_changes: on a quiet day, 3 genuine bullet points are better than 5 padded ones. The minimum of 3 in the schema is the floor only when 3 real changes exist; if fewer are genuine, stretch minimally and clearly.

FRAMING WITHOUT ADVICE — never prescribe action. The briefing reports and frames; the reader decides.
- Forbidden words in any analytical field: "buy", "sell", "hold", "should", "recommend", "consider buying", "consider selling", "good opportunity", "don't miss", "time to".
- Use historical-pattern framing instead: "Historically, X preceded Y in past cycles"; "This reinforces/undermines the thesis that Z"; "Long-term holders remain at N%, unchanged across the drawdown"; "Positioning has shifted toward X while spot flows stayed Y, a divergence that has historically resolved in favor of spot."
- The goal: a sophisticated reader walks away with a clear framing from which they can draw their own conclusion. Never do the concluding for them.

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

  if (EXPERT_CONTEXT_ENABLED) {
    sections.push(`## EXPERT REFERENCE FRAMEWORK
The framing below encodes canonical Bitcoin analytical lenses. Use it to inform the "why it matters" framing ONLY WHERE A LENS GENUINELY FITS the day's story (~90% relevance). Do NOT apply a lens to every story. Do NOT quote the framework verbatim. Do NOT restate it. Use it as the analytical prior the briefing is written from. Refer back to the PRIORITY OVERRIDE RULES in the system prompt for the earned-significance rule that governs when to reach for these lenses.

${EXPERT_CONTEXT}`);
  }

  // News articles
  const articles = Array.isArray(news?.articles) ? news.articles : [];
  const articlesText = articles
    .map(
      (a, i) =>
        `${i + 1}. **${a.title}**\n   Source: ${a.source}\n   URL: ${a.url}\n   Published: ${a.published_at}\n   Description: ${a.description ?? "N/A"}${a.content ? `\n   Full article: ${a.content}` : ""}`
    )
    .join("\n\n");
  sections.push(`## News Articles (${articles.length} total)\n${articlesText || "No articles available."}`);

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

    if (market.funding_rate) {
      const fr = market.funding_rate;
      const bps = (fr.weighted_rate * 10_000).toFixed(2);
      const oiBillions = (fr.total_open_interest_usd / 1e9).toFixed(2);
      const perExchange = fr.exchanges
        .map((e) => `${e.exchange}: ${(e.funding_rate * 10_000).toFixed(2)}bps, OI $${(e.open_interest_usd / 1e9).toFixed(2)}B`)
        .join("; ");
      sections.push(`## BTC Perpetual Futures Funding Rate
- OI-Weighted Average: ${bps} bps (${fr.annualized_rate_pct.toFixed(1)}% annualized)
- Total Open Interest: $${oiBillions}B
- Per-exchange: ${perExchange}`);
    }

    if (market.fear_greed) {
      sections.push(`## Crypto Fear & Greed Index
- Value: ${market.fear_greed.value}/100
- Classification: ${market.fear_greed.label}`);
    }

    if (market.correlation_matrix) {
      const cm = market.correlation_matrix;
      const goldCorr = cm.btc_gold_90d != null ? cm.btc_gold_90d.toFixed(2) : "N/A";
      const spCorr = cm.btc_sp500_90d != null ? cm.btc_sp500_90d.toFixed(2) : "N/A";
      sections.push(`## 90-Day Rolling Correlations
- BTC vs Gold: ${goldCorr} (${cm.data_points_gold} data points)
- BTC vs S&P 500: ${spCorr} (${cm.data_points_sp500} data points)
- Period: ${cm.period_start} to ${cm.period_end}`);
    }

    // Comparative baselines — gives Claude quantitative anchors so prose
    // cannot vague-handwave. Only non-null fields are rendered.
    if (market.comparative) {
      const c = market.comparative;
      const lines: string[] = [];
      if (c.realized_vol_30d_pct != null) {
        lines.push(
          `- Realized volatility 30d: ${c.realized_vol_30d_pct.toFixed(1)}% annualized${
            c.realized_vol_90d_pct != null
              ? ` (90d: ${c.realized_vol_90d_pct.toFixed(1)}%)`
              : ""
          }`
        );
      }
      if (c.price_vs_30d_avg_pct != null) {
        lines.push(
          `- Price vs 30d average: ${c.price_vs_30d_avg_pct >= 0 ? "+" : ""}${c.price_vs_30d_avg_pct.toFixed(2)}%`
        );
      }
      if (c.price_30d_high != null && c.price_30d_low != null) {
        lines.push(
          `- 30-day range: $${c.price_30d_low.toLocaleString()} low to $${c.price_30d_high.toLocaleString()} high`
        );
      }
      if (c.funding_rate_30d_avg_pct != null && c.funding_rate_30d_percentile != null) {
        lines.push(
          `- Funding rate 30d avg: ${c.funding_rate_30d_avg_pct.toFixed(2)}% annualized. Today sits in the ${c.funding_rate_30d_percentile.toFixed(0)}th percentile of the last 30 days.`
        );
      }
      if (c.fear_greed_30d_avg != null && c.fear_greed_30d_change != null) {
        lines.push(
          `- Fear & Greed 30d avg: ${c.fear_greed_30d_avg.toFixed(0)}. Today is ${c.fear_greed_30d_change >= 0 ? "+" : ""}${c.fear_greed_30d_change.toFixed(0)} vs that mean.`
        );
      }
      if (c.etf_flows_30d_avg_usd != null) {
        const avgM = (c.etf_flows_30d_avg_usd / 1e6).toFixed(1);
        const zPart =
          c.etf_flows_30d_z_score != null
            ? ` Today's flow is ${c.etf_flows_30d_z_score >= 0 ? "+" : ""}${c.etf_flows_30d_z_score.toFixed(2)}σ vs that mean.`
            : "";
        lines.push(`- ETF flows 30d avg: $${avgM}M per day.${zPart}`);
      }

      if (lines.length > 0) {
        sections.push(`## Comparative Baselines (use these to anchor prose, never vague-handwave)
When you characterize any quantitative claim, reference the comparative baseline if one exists. Do NOT use intensifiers like "significant", "major", "elevated" without a quantitative anchor from below. If a baseline is missing, state the raw number plainly and do not imply context you don't have.

${lines.join("\n")}`);
      }
    }
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

  // Day classification (internal signal, steers depth and tone)
  if (payload.dayContext) {
    const c = payload.dayContext;
    const depthGuidance = {
      heavy: "Use the full 7 top_stories and develop deeper framing. Earned significance has been met.",
      standard: "Use 5-6 top_stories with standard framing. Do not manufacture depth beyond what the data supports.",
      light: "Use 5 top_stories maximum. Keep narrative_consensus.rationale terse. No manufactured tension. Let flat stories read flat.",
    }[c.depth_weight];

    sections.push(`## DAY CONTEXT (internal signal, overrideable)
Classification: ${c.label}
Depth weight: ${c.depth_weight}
Confidence: ${c.confidence.toFixed(2)}
Reasoning: ${c.reasoning}
Suggested opening tone: "${c.day_tone_line}"

${depthGuidance}

You may override this classification if today's data clearly contradicts it (priority-override rules in the system prompt still apply). Otherwise treat it as a depth-weighting signal.`);
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
  run: async (rawPayload: Partial<AiBrainPayload>): Promise<AiBrainOutput> => {
    // Defensive payload normalization so dashboard manual tests or partial
    // payloads do not crash inside buildUserPrompt.
    const payload: AiBrainPayload = {
      date: rawPayload?.date ?? new Date().toISOString().split("T")[0],
      news: {
        articles: Array.isArray(rawPayload?.news?.articles)
          ? rawPayload.news!.articles
          : [],
      },
      market: rawPayload?.market ?? null,
      triageContext: rawPayload?.triageContext,
      dayContext: rawPayload?.dayContext,
    };
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
      articleCount: Array.isArray(payload?.news?.articles) ? payload.news.articles.length : 0,
      expertContextEnabled: EXPERT_CONTEXT_ENABLED,
    });

    const result = await callClaudeJSON<AiBrainOutput>({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 8192,
      schema: AiBrainOutputSchema,
      retryOnSchemaError: true,
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

    // Observability: emit a compact calibration log so rubric tightness can
    // be tuned over time. Columns worth watching across 2-3 weeks of runs:
    //   triageCandidates6Plus vs totalItemsIncluded (how aggressively the
    //   impact-mechanism filter is dropping ranked stories).
    const triageRankings = payload?.triageContext ?? [];
    const totalItems =
      deduped.top_stories.length +
      deduped.regulatory.length +
      deduped.adoption.length;

    logger.info("AI Brain completed", {
      storyCount: deduped.top_stories.length,
      regulatoryCount: deduped.regulatory.length,
      adoptionCount: deduped.adoption.length,
      totalItemsIncluded: totalItems,
      triageCandidatesTotal: triageRankings.length,
      triageCandidates6Plus: triageRankings.filter((t) => t.importance >= 6).length,
      triageCandidates7Plus: triageRankings.filter((t) => t.importance >= 7).length,
      dropRate6Plus:
        triageRankings.filter((t) => t.importance >= 6).length > 0
          ? `${(
              (1 -
                totalItems /
                  triageRankings.filter((t) => t.importance >= 6).length) *
              100
            ).toFixed(0)}%`
          : "n/a",
      dayClassification: payload?.dayContext?.label ?? null,
      depthWeight: payload?.dayContext?.depth_weight ?? null,
      classificationConfidence: payload?.dayContext?.confidence ?? null,
    });

    return deduped;
  },
});
