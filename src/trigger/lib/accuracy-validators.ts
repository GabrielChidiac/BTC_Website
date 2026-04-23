// Accuracy validators for AI-generated briefing content.
//
// Each validator scans user-facing text fields for claims that contradict the
// deterministic data we collected ourselves (market numbers, scraped article
// text, real URLs). Violations feed a correction retry loop in ai-brain.ts so
// Claude repairs its own output instead of hard-failing the pipeline.
//
// Validators here MUST be pure functions: no I/O, no side effects, no logging.
// ai-brain.ts is responsible for running them and handling the retry.

import type {
  TopStory,
  RegulatoryUpdate,
  AdoptionUpdate,
  HeroThreeLines,
  DailyDiff,
  NarrativeConsensus,
  MacroContext,
  RawArticle,
} from "@/lib/types";

export interface AccuracyViolation {
  kind:
    | "directional_inconsistency"
    | "narrative_consensus_contradiction"
    | "summary_unsourced";
  field: string;
  phrase: string;
  reason: string;
}

interface BriefingSubset {
  top_stories: TopStory[];
  regulatory: RegulatoryUpdate[];
  adoption: AdoptionUpdate[];
  hero_three_lines?: HeroThreeLines;
  daily_diff: DailyDiff;
  narrative_consensus: NarrativeConsensus;
  macro_context: MacroContext;
}

// Phrases that assert BTC/price weakness over the current period (week, today,
// recent days). These are flagged only when 7d change is meaningfully positive.
// Single words ("drop", "decline") are intentionally NOT in the list because
// they appear legitimately in prose about intra-day moves even on positive
// weeks; we only catch phrases that bind the weakness to the current period.
const WEEKLY_WEAKNESS_PHRASES = [
  "price weakness",
  "price decline",
  "price drop",
  "price fell",
  "price dropped",
  "price slumped",
  "weekly decline",
  "weekly drop",
  "weekly weakness",
  "during a drop",
  "during the drop",
  "during a sell-off",
  "during the sell-off",
  "during a selloff",
  "during the selloff",
  "amid selling",
  "amid a sell-off",
  "amid a selloff",
  "amid the sell-off",
  "amid the selloff",
  "amid the decline",
  "amid the drop",
  "amid weakness",
  "despite the drop",
  "despite the decline",
  "despite the fall",
  "despite the sell-off",
  "despite the selloff",
  "despite price weakness",
  "despite price decline",
  "weakness in bitcoin",
  "weakness in btc",
  "bitcoin decline",
  "bitcoin drop",
  "bitcoin fell",
  "bitcoin plunge",
  "bitcoin slide",
  "bitcoin retreat",
  "bitcoin weakness",
  "bitcoin sell-off",
  "bitcoin selloff",
  "btc decline",
  "btc drop",
  "btc fell",
  "in a sell-off",
  "in a selloff",
  "sharp drop",
  "broader drop",
  "pullback",
];

// Phrases that assert BTC/price strength over the current period. Flagged only
// when 7d change is meaningfully negative. Same single-word-exclusion rationale.
const WEEKLY_STRENGTH_PHRASES = [
  "price strength",
  "price rally",
  "price surge",
  "price rose",
  "price climbed",
  "price surged",
  "price rallied",
  "weekly rally",
  "weekly gain",
  "weekly strength",
  "bitcoin rally",
  "bitcoin surge",
  "bitcoin surged",
  "bitcoin rallied",
  "bitcoin breakout",
  "bitcoin climb",
  "bitcoin climbed",
  "bitcoin gain",
  "bitcoin gained",
  "btc rally",
  "btc surge",
  "btc rallied",
  "btc surged",
  "during a rally",
  "during the rally",
  "amid a rally",
  "amid the rally",
  "rally in bitcoin",
  "strength in bitcoin",
  "strength in btc",
];

// Threshold in % for what counts as a meaningful weekly direction. Below this
// the week is effectively flat and directional language in prose is acceptable
// either way. Tuned to avoid false positives on noise days where |7d| < 1.5%.
const WEEKLY_DIRECTION_THRESHOLD_PCT = 1.5;

/**
 * Scan all user-facing text fields for directional claims (weekly weakness or
 * weekly strength) that contradict the sign of market.price.change_7d_pct.
 * Returns a list of specific violations; empty array means the briefing is
 * internally consistent with the weekly move.
 */
export function findDirectionalViolations(
  briefing: BriefingSubset,
  market: { change_7d_pct: number },
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const change7d = market.change_7d_pct;
  const weekIsUp = change7d > WEEKLY_DIRECTION_THRESHOLD_PCT;
  const weekIsDown = change7d < -WEEKLY_DIRECTION_THRESHOLD_PCT;

  if (!weekIsUp && !weekIsDown) {
    return violations; // flat week, directional language is acceptable
  }

  const scan = (text: string | undefined, field: string): void => {
    if (!text) return;
    const lower = text.toLowerCase();
    if (weekIsUp) {
      for (const phrase of WEEKLY_WEAKNESS_PHRASES) {
        if (lower.includes(phrase)) {
          violations.push({
            kind: "directional_inconsistency",
            field,
            phrase,
            reason: `Field "${field}" says "${phrase}" but the 7-day price change is +${change7d.toFixed(2)}%. You may not characterize this week as weakness.`,
          });
        }
      }
    }
    if (weekIsDown) {
      for (const phrase of WEEKLY_STRENGTH_PHRASES) {
        if (lower.includes(phrase)) {
          violations.push({
            kind: "directional_inconsistency",
            field,
            phrase,
            reason: `Field "${field}" says "${phrase}" but the 7-day price change is ${change7d.toFixed(2)}%. You may not characterize this week as strength.`,
          });
        }
      }
    }
  };

  briefing.top_stories.forEach((s, i) => {
    scan(s.headline, `top_stories[${i}].headline`);
    scan(s.summary, `top_stories[${i}].summary`);
  });
  briefing.regulatory.forEach((r, i) => {
    scan(r.headline, `regulatory[${i}].headline`);
    scan(r.summary, `regulatory[${i}].summary`);
  });
  briefing.adoption.forEach((a, i) => {
    scan(a.headline, `adoption[${i}].headline`);
    scan(a.summary, `adoption[${i}].summary`);
  });
  if (briefing.hero_three_lines) {
    scan(briefing.hero_three_lines.move, "hero_three_lines.move");
    scan(briefing.hero_three_lines.signal, "hero_three_lines.signal");
    scan(briefing.hero_three_lines.watch, "hero_three_lines.watch");
  }
  scan(briefing.daily_diff.price_change, "daily_diff.price_change");
  scan(briefing.daily_diff.sentiment_shift, "daily_diff.sentiment_shift");
  briefing.daily_diff.key_changes.forEach((k, i) => {
    scan(k, `daily_diff.key_changes[${i}]`);
  });
  scan(briefing.narrative_consensus.label, "narrative_consensus.label");
  scan(briefing.narrative_consensus.rationale, "narrative_consensus.rationale");
  scan(briefing.macro_context.narrative, "macro_context.narrative");
  scan(briefing.macro_context.btc_correlation_note, "macro_context.btc_correlation_note");

  return violations;
}

/**
 * Cross-check narrative_consensus.label against the weekly move and ETF flow
 * z-score. A label asserting accumulation or bullish institutional positioning
 * while the week is sharply down AND ETF flows are below average is a direct
 * contradiction that reaches the homepage with false authority under the
 * "BTC Today read" badge.
 */
export function findNarrativeConsensusContradictions(
  briefing: BriefingSubset,
  market: {
    change_7d_pct: number;
    etf_flows_30d_z_score: number | null;
  },
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const label = (briefing.narrative_consensus.label ?? "").toLowerCase();
  const score = briefing.narrative_consensus.score;
  const change7d = market.change_7d_pct;
  const etfZ = market.etf_flows_30d_z_score;

  const bullishKeywords = [
    "accumulation",
    "bullish",
    "risk-on",
    "risk on",
    "optimistic",
    "buying",
    "expansion",
    "greed",
  ];
  const bearishKeywords = [
    "risk-off",
    "risk off",
    "defensive",
    "capitulation",
    "selling",
    "distribution",
    "de-risking",
    "derisking",
    "fear",
  ];

  const isBullishLabel =
    bullishKeywords.some((k) => label.includes(k)) || score > 30;
  const isBearishLabel =
    bearishKeywords.some((k) => label.includes(k)) || score < -30;

  // Contradiction: bullish label, sharp weekly decline, ETF flows below avg.
  if (
    isBullishLabel &&
    change7d < -3 &&
    etfZ !== null &&
    etfZ < -0.5
  ) {
    violations.push({
      kind: "narrative_consensus_contradiction",
      field: "narrative_consensus.label",
      phrase: briefing.narrative_consensus.label,
      reason: `Label "${briefing.narrative_consensus.label}" (score ${score}) asserts bullish institutional positioning, but 7d change is ${change7d.toFixed(2)}% and ETF flow z-score is ${etfZ.toFixed(2)} (below 30-day average). Pick a label consistent with the data: "Defensive", "Distribution", or "Mixed / No Clear Signal".`,
    });
  }

  // Contradiction: bearish label, sharp weekly rally, ETF flows above avg.
  if (
    isBearishLabel &&
    change7d > 3 &&
    etfZ !== null &&
    etfZ > 0.5
  ) {
    violations.push({
      kind: "narrative_consensus_contradiction",
      field: "narrative_consensus.label",
      phrase: briefing.narrative_consensus.label,
      reason: `Label "${briefing.narrative_consensus.label}" (score ${score}) asserts bearish positioning, but 7d change is +${change7d.toFixed(2)}% and ETF flow z-score is +${etfZ.toFixed(2)} (above 30-day average). Pick a label consistent with the data: "Accumulation", "Risk-On", or "Mixed / No Clear Signal".`,
    });
  }

  return violations;
}

/**
 * Each story summary should reference at least one verbatim phrase from the
 * source article's scraped text. This is the "source quote" gate — it proves
 * Claude actually read the article rather than confabulating implications.
 *
 * The check is lenient on purpose: we only require any 6+ word phrase from the
 * summary to appear in the article text, OR any proper noun / dollar amount /
 * percentage / company name overlap. If the summary is entirely free-form
 * interpretation with zero shared tokens, that's a violation.
 */
export function findUnsourcedSummaries(
  briefing: BriefingSubset,
  articlesByUrl: Map<string, RawArticle>,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];

  const check = (
    summary: string | undefined,
    url: string | undefined,
    field: string,
  ): void => {
    if (!summary || !url) return;
    const article = articlesByUrl.get(url);
    // No scraped content? We can't validate; skip rather than false-flag.
    if (!article?.content) return;

    const summaryLower = summary.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const titleLower = (article.title ?? "").toLowerCase();

    // 1. Title overlap: any 3+ word substring of the title in the summary?
    const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 3);
    for (let i = 0; i <= titleWords.length - 3; i++) {
      const trigram = titleWords.slice(i, i + 3).join(" ");
      if (summaryLower.includes(trigram)) return; // sourced
    }

    // 2. Dollar amount, percentage, or comma-separated number from article?
    const numberPattern = /\$[\d,.]+(?:\s*(?:million|billion|trillion|m|b))?|\d+(?:\.\d+)?%|\d{1,3}(?:,\d{3})+/gi;
    const articleNumbers = new Set(
      (article.content.match(numberPattern) ?? []).map((n) => n.toLowerCase()),
    );
    const summaryNumbers = (summary.match(numberPattern) ?? []).map((n) =>
      n.toLowerCase(),
    );
    for (const n of summaryNumbers) {
      if (articleNumbers.has(n)) return; // sourced
    }

    // 3. Any capitalized multi-word proper noun in the summary also in the
    //    article? Catches company/person names that summary and article share.
    const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    const summaryProperNouns = summary.match(properNounPattern) ?? [];
    for (const pn of summaryProperNouns) {
      if (contentLower.includes(pn.toLowerCase())) return; // sourced
    }

    // 4. Any 5-word contiguous phrase from the summary in the article text?
    const summaryWords = summary.split(/\s+/);
    for (let i = 0; i <= summaryWords.length - 5; i++) {
      const phrase = summaryWords.slice(i, i + 5).join(" ").toLowerCase();
      if (phrase.length < 20) continue;
      if (contentLower.includes(phrase)) return; // sourced
    }

    // No anchor to the article found.
    violations.push({
      kind: "summary_unsourced",
      field,
      phrase: summary.slice(0, 80),
      reason: `Summary for ${field} contains no verbatim phrase, shared number, or shared proper noun from the source article at ${url}. Rewrite the summary to reference specific facts from the article text.`,
    });
  };

  briefing.top_stories.forEach((s, i) => check(s.summary, s.url, `top_stories[${i}].summary`));
  briefing.regulatory.forEach((r, i) => check(r.summary, r.url, `regulatory[${i}].summary`));
  briefing.adoption.forEach((a, i) => check(a.summary, a.url, `adoption[${i}].summary`));

  return violations;
}

/**
 * Format a list of violations for inclusion in a correction retry prompt.
 * Groups by kind so Claude can address each category in one pass.
 */
export function formatViolationsForRetry(violations: AccuracyViolation[]): string {
  if (violations.length === 0) return "";

  const byKind = new Map<string, AccuracyViolation[]>();
  for (const v of violations) {
    const list = byKind.get(v.kind) ?? [];
    list.push(v);
    byKind.set(v.kind, list);
  }

  const blocks: string[] = [];
  for (const [kind, list] of byKind.entries()) {
    const lines = list.map((v) => `  - ${v.reason}`).join("\n");
    blocks.push(`[${kind}] (${list.length} violation${list.length === 1 ? "" : "s"})\n${lines}`);
  }

  return blocks.join("\n\n");
}
