import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { DayClassificationSchema } from "@/lib/schemas";
import type {
  DayClassification,
  NewsCollectorOutput,
  MarketCollectorOutput,
  TriageItem,
} from "@/lib/types";

// ─── System prompt ─────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You are a Bitcoin market classifier. Before a full daily briefing is written, you read today's raw news and market data and produce a single classification that steers how the briefing is written.

CRITICAL: Return ONLY valid JSON. No markdown fences, no extra text.

Return this exact shape:
{
  "label": "thesis_shift" | "risk_change" | "mostly_noise" | "mixed",
  "confidence": 0.0 to 1.0,
  "depth_weight": "heavy" | "standard" | "light",
  "reasoning": "<1-2 sentences, internal only, explaining what drove the classification>",
  "day_tone_line": "<1 sentence in natural voice that a calibrating human analyst would open with>"
}

═══════════════════════════════════════════════════════════════════════════
BASE RATE (this is the most important rule)
═══════════════════════════════════════════════════════════════════════════

In a typical month: ~70% of days are mostly_noise. ~15% are mixed. ~10%
are risk_change. ~5% are thesis_shift. The default for any given day is
mostly_noise. A non-noise label must be EARNED with concrete evidence that
clears the bar below. If you cannot quote a specific named event or cross a
specific quantitative threshold, the correct answer is mostly_noise.

═══════════════════════════════════════════════════════════════════════════
LABEL DEFINITIONS (with anchored thresholds)
═══════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────
thesis_shift — rare, structural, changes long-term holding case
────────────────────────────────────────────────────────────
Qualifies only if ONE of these is true today:
- A sitting G7/G20 central bank announces BTC reserves or direct policy
- SEC or equivalent approves a first-of-kind product (e.g. 2024 spot ETF)
- A sovereign government adopts/bans BTC at the legal-tender level
- US executive order with direct BTC mechanism (strategic reserve, tax, ban)
- A nation-scale geopolitical event that structurally shifts BTC's role
  (e.g. 2022 sanctions regime, 2021 China mining ban)

Depth weight: heavy. Confidence: 0.85+.

NOT thesis_shift: analyst predictions, corporate treasury additions of any
size, ETF flow records unless accompanied by the above, "considering" news.

────────────────────────────────────────────────────────────
risk_change — near-term risk materially rose or fell today
────────────────────────────────────────────────────────────
Qualifies only if ONE of these is true:
- BTC moved >4% intraday with identifiable catalyst
- ETF outflows >$500M in one day OR 5+ consecutive outflow days
- Funding rate in top/bottom decile of last 30 days (use comparative.funding_rate_30d_percentile >= 90 or <= 10)
- Major exchange insolvency/hack rumor or confirmation
- Enforcement action against a major BTC-related actor (not routine)
- Regulatory PROPOSAL with >50% passage likelihood in major jurisdiction
- Realized vol jumped >50% vs 30d avg

Depth weight: heavy or standard, based on confidence. Confidence: 0.65+.

NOT risk_change: a 2% daily move with no catalyst. Routine news. Generic
"market is volatile" framing without a specific trigger.

────────────────────────────────────────────────────────────
mostly_noise — default, should be ~70% of days
────────────────────────────────────────────────────────────
Qualifies if ALL of these are true:
- Price moved within ±2% on the day AND within 30-day range
- No headlines from the thesis_shift or risk_change bars above
- Flows, funding, F&G within 30-day normal range
- No named institutional moves above $50M

Depth weight: light. Confidence: 0.7+.

Noise days are NOT failure days. Calling a quiet day quiet is a feature.

────────────────────────────────────────────────────────────
mixed — real activity in multiple directions, no dominant signal
────────────────────────────────────────────────────────────
Use SPARINGLY. Only when the day clearly has substantive activity (would be
risk_change or thesis_shift if any one element dominated) but the signals
cancel out. Example: big ETF inflow + matching outflow from another issuer,
or bullish regulatory news in one jurisdiction with bearish in another.

Depth weight: standard. Confidence: 0.5-0.8.

If you're reaching for "mixed" because noise feels wrong to say, pick noise.

═══════════════════════════════════════════════════════════════════════════
HISTORICAL SMOOTHING (regression to the mean)
═══════════════════════════════════════════════════════════════════════════

The recent_classifications list in the user prompt shows what you classified
on previous days. Use it:
- If the last 5 days were noise and today looks borderline, lean noise.
- If you classified 3+ consecutive days as risk_change, the bar for today
  being risk_change RISES. Regression to mean is real.
- If you've never classified thesis_shift in the last 30 days, don't go
  looking for one today. Thesis shifts are once-per-quarter events.
- The natural distribution should roughly match the base rate above. If
  your recent history is skewed (e.g. 10 straight non-noise days), that's a
  signal you've been over-classifying, not that Bitcoin is unusually active.

═══════════════════════════════════════════════════════════════════════════
day_tone_line (a one-line tone summary for the day)
═══════════════════════════════════════════════════════════════════════════

CLOSED SET: day_tone_line MUST be EXACTLY one of the approved phrases below, copied verbatim. Free-form generation risks the tone contradicting the label (e.g., label "mostly_noise" with tone "Risk is rising.") and gets overwritten by the pipeline. Pick the phrase that best matches the classification; the pipeline will normalize any off-list string to a label-default anyway.

Approved phrases by label (pick ONE, verbatim):

mostly_noise:
- "A quiet day for Bitcoin."
- "Little moved today, but a few flows are worth watching."
- "The market took a breath today."
- "A routine session, nothing structural today."

risk_change:
- "Risk is rising."
- "Today changed the near-term picture."
- "The calm broke today."
- "Near-term risk shifted today."

thesis_shift:
- "Today mattered."
- "This is the kind of day the long-term thesis turns on."
- "A structural day for Bitcoin."
- "A thesis day, not a noise day."

mixed:
- "Pockets of movement today, no dominant signal."
- "The day pulled in two directions."
- "A mixed session, signals cut both ways."

Never use em dashes or en dashes. Use commas, periods, or semicolons.`;

// ─── Types ─────────────────────────────────────────────────────────────────

interface DayClassifierPayload {
  date: string;
  news: NewsCollectorOutput;
  market: MarketCollectorOutput | null;
  triageRankings: TriageItem[];
  recentClassifications: { date: string; label: string }[];
}

// ─── Helper: build compact input for the classifier ───────────────────────

function buildClassifierPrompt(payload: DayClassifierPayload): string {
  const { date, news, market, triageRankings, recentClassifications } = payload;
  const articles = Array.isArray(news?.articles) ? news.articles : [];
  const rankings = Array.isArray(triageRankings) ? triageRankings : [];

  // Compact news list: title + source + top-3 triage reasons
  const topArticles = rankings.length > 0
    ? rankings.slice(0, 10).map((r) => {
        const article = articles[r.index];
        if (!article) return null;
        return `  [${r.importance}/10] ${article.title} (${article.source}) — ${r.reasoning}`;
      }).filter(Boolean).join("\n")
    : articles.slice(0, 10).map((a) => `  - ${a.title} (${a.source})`).join("\n");

  const marketBlock = market
    ? `Price: $${market.price.usd.toLocaleString()} (24h ${market.price.change_24h_pct >= 0 ? "+" : ""}${market.price.change_24h_pct.toFixed(2)}%, 7d ${market.price.change_7d_pct >= 0 ? "+" : ""}${market.price.change_7d_pct.toFixed(2)}%)
Dominance: ${market.dominance_pct.toFixed(1)}%
RSI-14: ${market.technical.rsi_14.toFixed(0)}
SMA-50: $${market.technical.sma_50.toLocaleString()}
SMA-200: $${market.technical.sma_200.toLocaleString()}
ETF flows today: ${market.etf_flows?.daily_net_flow_usd != null ? `$${(market.etf_flows.daily_net_flow_usd / 1e6).toFixed(1)}M` : "unavailable"}
Funding (annualized): ${market.funding_rate?.annualized_rate_pct != null ? `${market.funding_rate.annualized_rate_pct.toFixed(2)}%` : "unavailable"}
Fear & Greed: ${market.fear_greed ? `${market.fear_greed.value} (${market.fear_greed.label})` : "unavailable"}
S&P 500 24h: ${market.comparisons.sp500_change_24h_pct != null ? `${market.comparisons.sp500_change_24h_pct >= 0 ? "+" : ""}${market.comparisons.sp500_change_24h_pct.toFixed(2)}%` : "N/A"}
Gold 24h: ${market.comparisons.gold_change_24h_pct != null ? `${market.comparisons.gold_change_24h_pct >= 0 ? "+" : ""}${market.comparisons.gold_change_24h_pct.toFixed(2)}%` : "N/A"}`
    : "Market data unavailable.";

  const history = recentClassifications.length > 0
    ? recentClassifications
        .map((c) => `  ${c.date}: ${c.label}`)
        .join("\n")
    : "  (no recent history available)";

  return `## Date
${date}

## Recent classifications (last 7 days, oldest first)
${history}

## Market snapshot
${marketBlock}

## Top news today (${articles.length} total collected)
${topArticles || "  (no articles)"}

Classify today. Return JSON only.`;
}

// ─── Helper: fetch last 7 days of classifications from Supabase ──────────

async function fetchRecentClassifications(
  todayDate: string
): Promise<{ date: string; label: string }[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("daily_briefings")
      .select("date, content")
      .lt("date", todayDate)
      .order("date", { ascending: false })
      .limit(7);

    if (error || !data) return [];

    const results: { date: string; label: string }[] = [];
    for (const row of data) {
      const content = row.content as { day_classification?: DayClassification | null } | null;
      const label = content?.day_classification?.label;
      if (label) {
        results.push({ date: row.date as string, label });
      }
    }
    // Return oldest first so the prompt reads chronologically
    return results.reverse();
  } catch {
    return [];
  }
}

// ─── Task ──────────────────────────────────────────────────────────────────

export const dayClassifierTask = task({
  id: "day-classifier",
  maxDuration: 120,
  run: async (
    payload: Partial<Omit<DayClassifierPayload, "recentClassifications">>
  ): Promise<DayClassification | null> => {
    const date = payload?.date ?? new Date().toISOString().split("T")[0];
    const news = payload?.news ?? { articles: [] };
    const market = payload?.market ?? null;
    const triageRankings = Array.isArray(payload?.triageRankings)
      ? payload!.triageRankings!
      : [];
    const articles = Array.isArray(news?.articles) ? news.articles : [];

    // If we have neither news nor market, classification is not meaningful.
    if (articles.length === 0 && !market) {
      logger.warn("Day classifier called with no news and no market — returning null");
      return null;
    }

    const recentClassifications = await fetchRecentClassifications(date);

    const fullPayload: DayClassifierPayload = {
      date,
      news: { articles },
      market,
      triageRankings,
      recentClassifications,
    };

    logger.info("Running day classifier", {
      date,
      articleCount: articles.length,
      triageCount: triageRankings.length,
      recentHistoryCount: recentClassifications.length,
    });

    const result = await callClaudeJSON<DayClassification>({
      system: CLASSIFIER_SYSTEM,
      prompt: buildClassifierPrompt(fullPayload),
      maxTokens: 500,
      schema: DayClassificationSchema,
    });

    if (result.error) {
      logger.warn("Day classifier failed, returning null", { error: result.error });
      return null;
    }

    const classification = result.data!;

    // Normalize day_tone_line to the closed set. If Claude returned an off-list
    // phrase, pick a deterministic default keyed to the classification label.
    // This prevents the failure mode where label says "mostly_noise" but the
    // tone line says "Risk is rising.", a self-contradiction.
    classification.day_tone_line = normalizeDayToneLine(
      classification.day_tone_line,
      classification.label,
    );

    logger.info("Day classification complete", {
      label: classification.label,
      depth_weight: classification.depth_weight,
      confidence: classification.confidence,
    });

    return classification;
  },
});

// ─── Day tone line normalization (closed set) ─────────────────────────────

const APPROVED_TONE_LINES: Record<DayClassification["label"], string[]> = {
  mostly_noise: [
    "A quiet day for Bitcoin.",
    "Little moved today, but a few flows are worth watching.",
    "The market took a breath today.",
    "A routine session, nothing structural today.",
  ],
  risk_change: [
    "Risk is rising.",
    "Today changed the near-term picture.",
    "The calm broke today.",
    "Near-term risk shifted today.",
  ],
  thesis_shift: [
    "Today mattered.",
    "This is the kind of day the long-term thesis turns on.",
    "A structural day for Bitcoin.",
    "A thesis day, not a noise day.",
  ],
  mixed: [
    "Pockets of movement today, no dominant signal.",
    "The day pulled in two directions.",
    "A mixed session, signals cut both ways.",
  ],
};

/**
 * Accept the Claude-returned day_tone_line only if it exactly matches one of
 * the approved phrases for the given label. Otherwise fall back to the first
 * approved phrase for that label — deterministic, semantically consistent,
 * and guaranteed to never contradict the classification.
 */
function normalizeDayToneLine(
  returned: string,
  label: DayClassification["label"],
): string {
  const approved = APPROVED_TONE_LINES[label] ?? APPROVED_TONE_LINES.mostly_noise;
  const trimmed = (returned ?? "").trim();
  if (approved.includes(trimmed)) {
    return trimmed;
  }
  // Off-list output. Log at debug level since this is expected behaviour on
  // some runs; the pipeline self-heals. Return the primary approved line for
  // this label.
  return approved[0];
}
