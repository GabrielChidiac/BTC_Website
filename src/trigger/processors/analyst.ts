import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { AnalysisBlockSchema } from "@/lib/schemas";
import { EXPERT_CONTEXT_DIGEST } from "./expert-context";
import { buildCountdownFactsBlock } from "@/trigger/lib/calendar";
import {
  validateAnalystRiskChangeEarned,
  formatViolationsForRetry,
} from "@/trigger/lib/accuracy-validators";
import type {
  AnalysisBlock,
  AnalystRegime,
  DayClassification,
  MarketCollectorOutput,
  NewsCollectorOutput,
  TriageItem,
} from "@/lib/types";

// ─── System prompt ────────────────────────────────────────────────────────
//
// The Analyst writes for itself, not the reader. The Synthesizer (today's AI
// Brain) translates this internal voice into briefing prose. Closed-vocabulary
// outputs prevent vague hedging; the schema is the contract, not the prose.

const ANALYST_SYSTEM = `You are a senior macro-financial analyst at a multi-strategy fund. You write for an internal investment-committee memo, not for retail. Your reader is another analyst who will translate your structured output into the public briefing later. They do not need pretty prose; they need defensible analytical claims grounded in today's data.

CRITICAL: Return ONLY valid JSON matching the AnalysisBlock schema. No markdown fences, no extra text, no comments.

Return this exact shape:
{
  "regime": "risk_on" | "risk_off" | "consolidation" | "transition" | "decoupling",
  "conviction": 0-100,
  "one_line_thesis": "<single sentence, internal voice>",
  "primary_drivers": [
    {
      "driver": "<short name like 'ETF accumulation' or 'macro repricing'>",
      "direction": "bullish" | "bearish" | "neutral",
      "magnitude": "strong" | "moderate" | "weak",
      "evidence": ["<2 to 4 specific facts cited verbatim from market or news>"]
    }
  ],
  "technical_posture": {
    "rsi_read": "overbought" | "neutral" | "oversold",
    "sma_alignment": "bullish_cross" | "bearish_cross" | "above_both" | "below_both" | "between",
    "structure": "trending_up" | "trending_down" | "ranging" | "breakout_attempt",
    "key_level": { "price": <number>, "type": "support" | "resistance", "significance": "<one short phrase>" }
  },
  "macro_assessment": {
    "fed_path_pricing": "<1 sentence; only reference events listed in CALENDAR FACTS BLOCK>",
    "correlation_state": { "gold": <-1..1 or null>, "sp500": <-1..1 or null>, "interpretation": "<one sentence>" },
    "fiscal_or_dollar_note": "<1 sentence; cite a real number from the data or omit>"
  },
  "risk_changed_today": true | false,
  "risk_change_evidence": ["<empty array if false; otherwise 1 to 3 specific data points that crossed a threshold>"],
  "confidence_caveats": ["<empty array is fine on clean-data days; otherwise list the genuine ambiguities>"],
  "data_gaps": ["<list source names that are missing or stale, e.g. 'etf_flows', 'funding_rate'>"]
}

═══════════════════════════════════════════════════════════════════════════
ANCHOR TO DATA (highest-priority rule)
═══════════════════════════════════════════════════════════════════════════

Every claim — driver evidence, technical level, correlation read, macro note — must trace to (a) a number from the MARKET DATA block, (b) an entity or event from the NEWS block, or (c) a date from the CALENDAR FACTS BLOCK. No training-data priors. No "the Fed is expected to" without a calendar event. No "ETFs accumulated" without an ETF flow number. If you cannot cite, drop the claim.

═══════════════════════════════════════════════════════════════════════════
EARNED-SIGNIFICANCE GATE FOR risk_changed_today
═══════════════════════════════════════════════════════════════════════════

Set risk_changed_today = true ONLY if at least one of these crossed today (cite the specific metric in risk_change_evidence):
- |ETF flow z-score| ≥ 1.0
- funding rate 30d percentile ≥ 90 OR ≤ 10
- |Fear & Greed change vs 30d avg| ≥ 15 points
- |price vs 30d avg| ≥ 5 percent
- |24h change| ≥ 3 percent OR |7d change| ≥ 5 percent
- realized vol jumped >50 percent vs 30d avg
- day_classifier label is "risk_change" or "thesis_shift"

If none of these crossed, risk_changed_today MUST be false and risk_change_evidence MUST be an empty array. Forcing risk_change on a quiet day is the worst failure mode for this role.

═══════════════════════════════════════════════════════════════════════════
REGIME RULES (closed vocabulary)
═══════════════════════════════════════════════════════════════════════════

- risk_on: BTC and risk assets coordinated up; SPX correlation > 0.5 with positive trend; flows positive; funding moderate-high.
- risk_off: BTC and risk assets coordinated down; flows negative or flat; funding compressed; F&G low.
- consolidation: |7d| < 2 percent and price inside 30d range; this is the most common regime — use it freely.
- transition: prior regime breaking down but new regime not yet established (mixed signals across flows, vol, correlation).
- decoupling: BTC and SPX 90d correlation < 0.3 AND |BTC 7d| > |SPX 7d| × 1.5. Rare — earn it.

Conviction calibration:
- 80-100: multiple independent signals align (flows + price + macro + technical).
- 50-79: 1 to 2 signals align, others neutral.
- 20-49: signals contradict or data is incomplete.
- 0-19: insufficient data; pair with confidence_caveats explaining why.

═══════════════════════════════════════════════════════════════════════════
ANALYTICAL PRIORS (use as a lens, never quote)
═══════════════════════════════════════════════════════════════════════════

${EXPERT_CONTEXT_DIGEST}

These priors are reference, not template. Apply a lens only when the day's data earns it. A flat consolidation day does not need a 2-sentence macro thesis — write the consolidation read plainly and move on.

═══════════════════════════════════════════════════════════════════════════
VOICE CONSTRAINTS
═══════════════════════════════════════════════════════════════════════════

- Internal-voice. Terse. No hedging adverbs ("perhaps", "somewhat", "potentially") unless they materially clarify.
- No em dashes or en dashes. Use commas, periods, semicolons.
- No retail crypto language ("moon", "diamond hands", "to the moon", "hodl").
- No invented dollar amounts, ticker names, or analyst attributions.

The Synthesizer downstream will translate your one_line_thesis and primary_drivers into reader-facing prose. You do not need to be readable; you need to be defensible.`;

// ─── Payload ──────────────────────────────────────────────────────────────

interface AnalystPayload {
  date: string;
  news: NewsCollectorOutput;
  market: MarketCollectorOutput | null;
  triageRankings?: TriageItem[];
  dayClassification?: DayClassification | null;
}

// ─── Prompt builder ───────────────────────────────────────────────────────

function buildAnalystPrompt(payload: AnalystPayload): string {
  const { date, news, market, triageRankings, dayClassification } = payload;
  const articles = Array.isArray(news?.articles) ? news.articles : [];
  const rankings = Array.isArray(triageRankings) ? triageRankings : [];

  // Top-N by triage importance, fall back to recency. Mirrors day-classifier.
  const topArticles = rankings.length > 0
    ? rankings.slice(0, 12).map((r) => {
        const article = articles[r.index];
        if (!article) return null;
        return `  [${r.importance}/10] ${article.title} (${article.source})`;
      }).filter(Boolean).join("\n")
    : articles.slice(0, 12).map((a) => `  - ${a.title} (${a.source})`).join("\n");

  const marketBlock = market
    ? buildMarketFactsBlock(market)
    : "MARKET DATA UNAVAILABLE — set data_gaps to include 'market'. Conviction must be ≤20.";

  const dayBlock = dayClassification
    ? `Day classification: ${dayClassification.label} (depth_weight=${dayClassification.depth_weight}, confidence=${dayClassification.confidence.toFixed(2)})`
    : "Day classification unavailable.";

  const calendarBlock = buildCountdownFactsBlock(date, 90);

  return `## Date
${date}

## DAY CLASSIFIER (precursor signal — use as input, not as conclusion)
${dayBlock}

## MARKET DATA BLOCK
${marketBlock}

## CALENDAR FACTS BLOCK (next 90 days; only reference events from this list)
${calendarBlock}

## NEWS BLOCK (top ${rankings.length > 0 ? Math.min(12, rankings.length) : Math.min(12, articles.length)} articles by triage importance${rankings.length === 0 ? " — recency fallback, triage failed" : ""})
${topArticles || "  (no articles available today)"}

Produce the AnalysisBlock JSON. No prose around the JSON.`;
}

// Compact market block — only the fields the analyst is permitted to cite.
function buildMarketFactsBlock(market: MarketCollectorOutput): string {
  const sign = (n: number | null | undefined): string =>
    n == null ? "N/A" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const comp = market.comparative ?? null;
  const compLines = comp
    ? [
        `realized_vol_30d_pct: ${comp.realized_vol_30d_pct?.toFixed(1) ?? "null"}`,
        `realized_vol_90d_pct: ${comp.realized_vol_90d_pct?.toFixed(1) ?? "null"}`,
        `price_vs_30d_avg_pct: ${comp.price_vs_30d_avg_pct?.toFixed(2) ?? "null"}`,
        `funding_rate_30d_percentile: ${comp.funding_rate_30d_percentile?.toFixed(0) ?? "null"}`,
        `fear_greed_30d_change: ${comp.fear_greed_30d_change?.toFixed(0) ?? "null"}`,
        `etf_flows_30d_z_score: ${comp.etf_flows_30d_z_score?.toFixed(2) ?? "null"}`,
      ].join(", ")
    : "comparative baselines unavailable";

  const correlations = market.correlation_matrix
    ? `BTC-SPX 90d=${market.correlation_matrix.btc_sp500_90d?.toFixed(2) ?? "null"}, BTC-Gold 90d=${market.correlation_matrix.btc_gold_90d?.toFixed(2) ?? "null"}`
    : "correlation_matrix unavailable";

  return `Price (USD): $${market.price.usd.toLocaleString()}
24h change: ${sign(market.price.change_24h_pct)} | 7d change: ${sign(market.price.change_7d_pct)}
Dominance: ${market.dominance_pct.toFixed(1)}%
Technical: RSI-14=${market.technical.rsi_14.toFixed(0)}, SMA-50=$${market.technical.sma_50.toLocaleString()}, SMA-200=$${market.technical.sma_200.toLocaleString()}, support=$${market.technical.support_level.toLocaleString()}, resistance=$${market.technical.resistance_level.toLocaleString()}
ETF flows today: ${market.etf_flows?.daily_net_flow_usd != null ? `$${(market.etf_flows.daily_net_flow_usd / 1e6).toFixed(1)}M` : "unavailable"}
Funding (annualized): ${market.funding_rate?.annualized_rate_pct != null ? `${market.funding_rate.annualized_rate_pct.toFixed(2)}%` : "unavailable"}
Fear & Greed: ${market.fear_greed ? `${market.fear_greed.value} (${market.fear_greed.label})` : "unavailable"}
Comparisons (24h): SPX ${sign(market.comparisons.sp500_change_24h_pct)}, Gold ${sign(market.comparisons.gold_change_24h_pct)}, DXY ${sign(market.comparisons.dxy_change_24h_pct)}
Correlations: ${correlations}
Comparative baselines: ${compLines}`;
}

// ─── Deterministic fallback ───────────────────────────────────────────────
//
// Produced when Claude (Anthropic + Kie.ai) exhausts or schema-retry fails.
// Conservative read of market data only: regime by 7d sign, conviction=30,
// no drivers, risk_changed_today only when day_classifier earned it. The
// Synthesizer must handle empty primary_drivers; downstream prose
// degrades gracefully when this fallback fires.
function buildAnalystFallback(
  market: MarketCollectorOutput | null,
  dayClassification: DayClassification | null | undefined,
): AnalysisBlock {
  const change7d = market?.price.change_7d_pct ?? 0;
  let regime: AnalystRegime = "consolidation";
  if (Math.abs(change7d) >= 2) {
    regime = change7d > 0 ? "risk_on" : "risk_off";
  }

  const dayLabel = dayClassification?.label;
  const riskChanged = dayLabel === "risk_change" || dayLabel === "thesis_shift";

  // RSI mapping — neutral when data missing.
  const rsi = market?.technical.rsi_14 ?? 50;
  const rsiRead =
    rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";

  const price = market?.price.usd ?? 0;
  const sma50 = market?.technical.sma_50 ?? price;
  const sma200 = market?.technical.sma_200 ?? price;
  const smaAlignment =
    price >= sma50 && price >= sma200
      ? "above_both"
      : price < sma50 && price < sma200
        ? "below_both"
        : "between";

  return {
    regime,
    conviction: 30,
    one_line_thesis: market
      ? `Fallback read: ${regime} regime inferred from 7d ${change7d >= 0 ? "+" : ""}${change7d.toFixed(2)}% with no analyst commentary available.`
      : "Fallback read: market data unavailable, no analytical claim possible.",
    primary_drivers: [],
    technical_posture: {
      rsi_read: rsiRead,
      sma_alignment: smaAlignment,
      structure: "ranging",
      key_level: {
        price: market?.technical.support_level ?? 0,
        type: "support",
        significance: "fallback default",
      },
    },
    macro_assessment: {
      fed_path_pricing: "Macro assessment unavailable in fallback.",
      correlation_state: {
        gold: market?.correlation_matrix?.btc_gold_90d ?? null,
        sp500: market?.correlation_matrix?.btc_sp500_90d ?? null,
        interpretation: "Fallback: correlations carried through without interpretation.",
      },
      fiscal_or_dollar_note: "",
    },
    risk_changed_today: riskChanged,
    risk_change_evidence: riskChanged && dayLabel
      ? [`day_classifier label = ${dayLabel}`]
      : [],
    confidence_caveats: ["analyst_unavailable_data_only_brief"],
    data_gaps: market ? [] : ["market"],
  };
}

// ─── Task ─────────────────────────────────────────────────────────────────

export const analystTask = task({
  id: "analyst",
  maxDuration: 180,
  run: async (
    payload: Partial<AnalystPayload>,
  ): Promise<AnalysisBlock> => {
    const date = payload?.date ?? new Date().toISOString().split("T")[0];
    const news = payload?.news ?? { articles: [] };
    const market = payload?.market ?? null;
    const triageRankings = Array.isArray(payload?.triageRankings)
      ? payload!.triageRankings!
      : [];
    const dayClassification = payload?.dayClassification ?? null;
    const articles = Array.isArray(news?.articles) ? news.articles : [];

    // No news AND no market → analysis is meaningless; return the deterministic
    // fallback with data_gaps populated so the Synthesizer can shorten depth.
    if (articles.length === 0 && !market) {
      logger.warn("Analyst called with no news and no market — using fallback");
      return buildAnalystFallback(null, dayClassification);
    }

    const fullPayload: AnalystPayload = {
      date,
      news: { articles },
      market,
      triageRankings,
      dayClassification,
    };

    logger.info("Running analyst", {
      date,
      articleCount: articles.length,
      triageCount: triageRankings.length,
      hasMarket: Boolean(market),
      dayLabel: dayClassification?.label ?? "(none)",
    });

    const userPrompt = buildAnalystPrompt(fullPayload);
    const result = await callClaudeJSON<AnalysisBlock>({
      system: ANALYST_SYSTEM,
      prompt: userPrompt,
      maxTokens: 2000,
      schema: AnalysisBlockSchema,
      retryOnSchemaError: true,
    });

    if (result.error || !result.data) {
      logger.warn("Analyst Claude call failed — using deterministic fallback", {
        error: result.error ?? "unknown",
      });
      return buildAnalystFallback(market, dayClassification);
    }

    let analysis = result.data;

    // Earned-significance gate. Schema can't see market data; this validator
    // checks risk_changed_today against thresholds. One correction retry on
    // violation, mirroring the Synthesizer's ensureDataConsistency pattern.
    const violations = validateAnalystRiskChangeEarned(
      analysis,
      market,
      dayClassification,
    );

    if (violations.length > 0) {
      logger.warn("Analyst earned-significance gate fired — running correction retry", {
        violations: violations.length,
        riskChangedTodayBeforeRetry: analysis.risk_changed_today,
      });
      const retryPrompt = `${userPrompt}\n\n---\n\nYour previous response failed the earned-significance validator:\n\n${formatViolationsForRetry(violations)}\n\nReturn ONLY corrected JSON. Set risk_changed_today=false and risk_change_evidence=[] unless you can cite a metric that crossed a threshold listed above.`;
      const retry = await callClaudeJSON<AnalysisBlock>({
        system: ANALYST_SYSTEM,
        prompt: retryPrompt,
        maxTokens: 2000,
        schema: AnalysisBlockSchema,
        retryOnSchemaError: true,
      });
      if (retry.data) {
        const retryViolations = validateAnalystRiskChangeEarned(
          retry.data,
          market,
          dayClassification,
        );
        if (retryViolations.length === 0) {
          analysis = retry.data;
          logger.info("Analyst retry resolved earned-significance violation");
        } else {
          // Retry still fails — coerce risk_changed_today=false deterministically.
          // The Synthesizer must trust this field; shipping a violation through
          // would break the hero earned-significance gate downstream.
          analysis = {
            ...retry.data,
            risk_changed_today: false,
            risk_change_evidence: [],
            confidence_caveats: [
              ...retry.data.confidence_caveats,
              "earned_significance_gate_coerced",
            ],
          };
          logger.warn("Analyst retry still violated gate — coercing risk_changed_today=false");
        }
      } else {
        // Retry call itself failed — coerce on the original output.
        analysis = {
          ...analysis,
          risk_changed_today: false,
          risk_change_evidence: [],
          confidence_caveats: [
            ...analysis.confidence_caveats,
            "earned_significance_gate_coerced",
          ],
        };
        logger.warn("Analyst retry call failed — coercing risk_changed_today=false on original");
      }
    }

    logger.info("Analyst complete", {
      regime: analysis.regime,
      conviction: analysis.conviction,
      driverCount: analysis.primary_drivers.length,
      riskChanged: analysis.risk_changed_today,
      caveats: analysis.confidence_caveats.length,
      gaps: analysis.data_gaps.length,
    });

    return analysis;
  },
});
