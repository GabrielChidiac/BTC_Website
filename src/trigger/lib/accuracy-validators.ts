// Accuracy validators for AI-generated briefing content.
//
// Each validator scans user-facing text fields for claims that contradict the
// deterministic data we collected ourselves (market numbers, scraped article
// text, real URLs). Violations feed a correction retry loop in synthesizer.ts
// (and analyst.ts for the analyst-only validators) so Claude repairs its own
// output instead of hard-failing the pipeline.
//
// Validators here MUST be pure functions: no I/O, no side effects, no logging.
// The owning task is responsible for running them and handling the retry.

import type {
  TopStory,
  RegulatoryUpdate,
  AdoptionUpdate,
  HeroThreeLines,
  DailyDiff,
  NarrativeConsensus,
  MacroContext,
  RawArticle,
  AnalysisBlock,
  MarketCollectorOutput,
  DayClassification,
} from "@/lib/types";

export interface AccuracyViolation {
  kind:
    | "directional_inconsistency"
    | "narrative_consensus_contradiction"
    | "summary_unsourced"
    | "narrative_score_drift"
    | "invented_macro_event"
    | "invented_daily_diff_event"
    | "invented_lookahead_date"
    | "unsourced_correlation_claim"
    | "hero_unearned_significance"
    | "hero_unsourced_claim"
    | "hero_invented_date"
    | "rationale_unanchored"
    | "analyst_risk_change_unearned";
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

  // Combined-signal contradictions (price + flows both lean against the label).
  // Bullish label, sharp weekly decline, ETF flows below avg.
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

  // Bearish label, sharp weekly rally, ETF flows above avg.
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

  // Single-signal contradictions: a sharp weekly move alone (>5%) is enough to
  // flag a label that asserts the opposite, even if ETF flows lean the other
  // way. Catches days where flows are confused but price has clearly broken
  // direction. Skip if the combined-signal check already flagged the label.
  const labelAlreadyFlagged = violations.some(
    (v) => v.field === "narrative_consensus.label",
  );
  if (!labelAlreadyFlagged && isBullishLabel && change7d < -5) {
    violations.push({
      kind: "narrative_consensus_contradiction",
      field: "narrative_consensus.label",
      phrase: briefing.narrative_consensus.label,
      reason: `Label "${briefing.narrative_consensus.label}" (score ${score}) reads bullish, but 7d change is ${change7d.toFixed(2)}% (down >5%). A sharp weekly decline contradicts a bullish read regardless of flows. Pick "Mixed / No Clear Signal" or a defensive label.`,
    });
  }
  if (!labelAlreadyFlagged && isBearishLabel && change7d > 5) {
    violations.push({
      kind: "narrative_consensus_contradiction",
      field: "narrative_consensus.label",
      phrase: briefing.narrative_consensus.label,
      reason: `Label "${briefing.narrative_consensus.label}" (score ${score}) reads bearish, but 7d change is +${change7d.toFixed(2)}% (up >5%). A sharp weekly rally contradicts a bearish read regardless of flows. Pick "Accumulation", "Risk-On", or "Mixed / No Clear Signal".`,
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

// ─── Shared helpers for inventiveness validators ───────────────────────────

const MONTH_FULL = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

// Number and proper-noun patterns reused across hero and daily_diff anchor
// checks. Hoisted to module scope so each validator does not re-compile them.
const NUMBER_PATTERN = /\$[\d,.]+(?:\s*(?:million|billion|trillion|m|b))?|\d+(?:\.\d+)?%|\d{1,3}(?:,\d{3})+/gi;
const PROPER_NOUN_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

interface MarketCorpusInput {
  price: { usd: number; change_24h_pct: number; change_7d_pct: number };
  fear_greed?: { value: number; label: string } | null;
  etf_flows?: {
    daily_net_flow_usd: number | null;
    mtd_net_flow_usd: number | null;
    total_net_assets_usd: number | null;
  } | null;
  funding_rate?: { weighted_rate: number; annualized_rate_pct: number } | null;
  dominance_pct?: number;
}

/**
 * Render today's market numbers in the same formats Claude tends to produce
 * (rounded USD, percentages with one or two decimals, $336m / $1.2b shapes)
 * so that NUMBER_PATTERN substring-matching finds them. Returns a normalized
 * lowercase string.
 */
function buildMarketCorpus(market: MarketCorpusInput): string {
  const parts: string[] = [];
  const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  parts.push(fmtUsd(market.price.usd));
  parts.push(`$${market.price.usd.toFixed(0)}`);
  parts.push(fmtPct(market.price.change_24h_pct));
  parts.push(`${market.price.change_24h_pct.toFixed(1)}%`);
  parts.push(fmtPct(market.price.change_7d_pct));
  parts.push(`${market.price.change_7d_pct.toFixed(1)}%`);
  if (market.dominance_pct !== undefined) parts.push(`${market.dominance_pct.toFixed(1)}%`);
  if (market.fear_greed) {
    parts.push(`${market.fear_greed.value}`, market.fear_greed.label.toLowerCase());
  }
  if (market.etf_flows?.daily_net_flow_usd !== null && market.etf_flows?.daily_net_flow_usd !== undefined) {
    const v = market.etf_flows.daily_net_flow_usd;
    parts.push(fmtUsd(v));
    parts.push(`$${(v / 1e6).toFixed(0)}m`, `$${(v / 1e6).toFixed(1)}m`);
    parts.push(`$${(v / 1e9).toFixed(2)}b`);
  }
  if (market.funding_rate) {
    parts.push(`${market.funding_rate.annualized_rate_pct.toFixed(1)}%`);
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Build a lowercase concatenation of every article's title + description +
 * scraped content. The reusable corpus for proper-noun and 5-word-phrase
 * matching across hero, daily_diff, and rationale validators.
 */
function buildArticleCorpus(
  articles: Array<{ title: string; description?: string; content?: string }>,
): string {
  return articles
    .map((a) => `${a.title} ${a.description ?? ""} ${a.content ?? ""}`)
    .join(" ")
    .toLowerCase();
}

/**
 * Lenient anchor check used for hero fields and daily_diff bullets. Rule:
 * - text with no number AND no proper noun → pass (vague stylistic prose)
 * - text with a number that matches the full corpus → pass
 * - text with a proper noun that matches the article corpus → pass
 * - otherwise → return one violation
 *
 * The "vague-passes" branch is intentional: hero.signal often reads
 * "Under the surface: nothing structural changed" — qualitative interpretation
 * with no specific entity. Flagging that would over-fire.
 */
function checkTextHasAnchor(
  text: string | undefined,
  fieldName: string,
  articleCorpus: string,
  fullCorpus: string,
  violationKind: AccuracyViolation["kind"],
): AccuracyViolation | null {
  if (!text || text.trim().length === 0) return null;
  const numbers = text.match(NUMBER_PATTERN) ?? [];
  const properNouns = text.match(PROPER_NOUN_PATTERN) ?? [];
  if (numbers.length === 0 && properNouns.length === 0) return null;
  if (numbers.some((n) => fullCorpus.includes(n.toLowerCase()))) return null;
  if (properNouns.some((pn) => articleCorpus.includes(pn.toLowerCase()))) return null;
  return {
    kind: violationKind,
    field: fieldName,
    phrase: text.slice(0, 100),
    reason: `${fieldName} cites specifics (${[...numbers, ...properNouns].slice(0, 4).join(", ")}) that do not appear in any source article or in today's market data. Drop the claim or rewrite to reference a fact present in the briefing inputs.`,
  };
}

/**
 * Build a normalized lowercase corpus combining the calendar block and every
 * article's title + description + scraped content. Augments the calendar with
 * human-readable date forms so a phrase like "January 28" matches a calendar
 * entry stored as "2026-01-28".
 */
function buildDateValidationCorpus(
  calendarBlock: string,
  articles: Array<{ title: string; description?: string; content?: string }>,
): string {
  const isoMatches = calendarBlock.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const humanForms: string[] = [];
  for (const iso of isoMatches) {
    const parts = iso.split("-");
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx < 0 || monthIdx > 11 || isNaN(day)) continue;
    humanForms.push(
      `${MONTH_FULL[monthIdx]} ${day}`,
      `${MONTH_ABBR[monthIdx]} ${day}`,
      `${MONTH_FULL[monthIdx]} ${day}, ${year}`,
      `${MONTH_FULL[monthIdx]} ${day} ${year}`,
    );
  }
  const articlesText = articles
    .map((a) => `${a.title} ${a.description ?? ""} ${a.content ?? ""}`)
    .join(" ");
  return [calendarBlock, ...humanForms, articlesText].join(" ").toLowerCase();
}

/**
 * Find date-like phrases in text. Catches "January 28", "Jan. 28", "Jan 28,
 * 2026", and ISO "2026-01-28". Returns each phrase exactly as written so the
 * caller can substring-match it into the validation corpus.
 *
 * Bare quarter-year ("Q1 2026") and bare relative-time ("next week") are
 * intentionally excluded because they cannot be cross-checked against a
 * specific calendar entry without additional inference.
 */
function extractDateMentions(text: string): string[] {
  const phrases = new Set<string>();
  const monthRe = new RegExp(
    `\\b(?:${MONTH_FULL.join("|")}|${MONTH_ABBR.join("|")})\\.?\\s+\\d{1,2}(?:,?\\s+20\\d{2})?\\b`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = monthRe.exec(text)) !== null) {
    phrases.add(m[0]);
  }
  const isoRe = /\b\d{4}-\d{2}-\d{2}\b/g;
  while ((m = isoRe.exec(text)) !== null) {
    phrases.add(m[0]);
  }
  return Array.from(phrases);
}

/**
 * Anti-hallucination validator for macro_context. Flags any explicit date
 * phrase in macro narrative / correlation note / key_macro_events that does
 * not appear in the calendar block (deterministic schedule) or in any input
 * article's content. Catches Claude inventing an FOMC, CPI, or PCE date that
 * looks plausible but does not exist on the BLS/Fed/BEA calendar.
 *
 * Vague references ("next FOMC", "in Q2") are not flagged — the validator
 * only enforces specific dated claims.
 */
export function findInventedMacroEvents(
  macro: { narrative: string; btc_correlation_note: string; key_macro_events: string[] },
  calendarBlock: string,
  articles: Array<{ title: string; description?: string; content?: string }>,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const corpus = buildDateValidationCorpus(calendarBlock, articles);

  const scan = (text: string | undefined, field: string): void => {
    if (!text) return;
    const dates = extractDateMentions(text);
    for (const phrase of dates) {
      if (!corpus.includes(phrase.toLowerCase())) {
        violations.push({
          kind: "invented_macro_event",
          field,
          phrase,
          reason: `Field "${field}" cites date "${phrase}" but that date does not appear in the AUTHORITATIVE CALENDAR or in any source article. Either remove the dated claim or replace with a date from the calendar block.`,
        });
      }
    }
  };

  scan(macro.narrative, "macro_context.narrative");
  scan(macro.btc_correlation_note, "macro_context.btc_correlation_note");
  macro.key_macro_events.forEach((e, i) => scan(e, `macro_context.key_macro_events[${i}]`));

  return violations;
}

/**
 * Anti-hallucination validator for daily_diff.key_changes. Each bullet must
 * have at least one concrete anchor (a number that matches market data, or a
 * proper noun that appears in the article corpus). Vague stylistic bullets
 * ("Mood remains cautiously optimistic") pass — they assert nothing
 * verifiable. The check fires only when a bullet asserts something specific
 * (a number, a percent, a named entity) and that specific is not sourced.
 */
export function findInventedDailyDiffEvents(
  daily_diff: { key_changes: string[] },
  articles: Array<{ title: string; description?: string; content?: string }>,
  market: MarketCorpusInput,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const articleCorpus = buildArticleCorpus(articles);
  const fullCorpus = `${articleCorpus} ${buildMarketCorpus(market)}`;

  daily_diff.key_changes.forEach((bullet, i) => {
    const v = checkTextHasAnchor(
      bullet,
      `daily_diff.key_changes[${i}]`,
      articleCorpus,
      fullCorpus,
      "invented_daily_diff_event",
    );
    if (v) violations.push(v);
  });

  return violations;
}

/**
 * Anti-hallucination validator for the enrichment looking_ahead string. Flags
 * date phrases that do not appear in the deterministic calendar block or in
 * any forward-looking article. Lives in this file so it shares the same
 * date-extraction infrastructure; called from enrichment.ts after the
 * Perplexity response has been parsed and citation markers stripped.
 */
export function findInventedLookingAheadDates(
  lookingAhead: string,
  calendarBlock: string,
  articles: Array<{ title: string; description?: string; content?: string }>,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  if (!lookingAhead || lookingAhead.trim().length === 0) return violations;
  const corpus = buildDateValidationCorpus(calendarBlock, articles);
  const dates = extractDateMentions(lookingAhead);
  for (const phrase of dates) {
    if (!corpus.includes(phrase.toLowerCase())) {
      violations.push({
        kind: "invented_lookahead_date",
        field: "looking_ahead",
        phrase,
        reason: `looking_ahead cites date "${phrase}" but that date does not appear in the AUTHORITATIVE CALENDAR or in any forward-looking article. Perplexity may not invent SEC deadlines, FOMC speeches, or filing dates.`,
      });
    }
  }
  return violations;
}

/**
 * Anti-hallucination validator for narrative_consensus.score. Anchors the
 * score to a quantitative blend of three signals (7d direction, ETF flow
 * z-score, funding rate percentile) and flags the AI score if it drifts more
 * than ±25 from the suggested anchor. Skips entirely when the signal anchors
 * are unavailable (rather than false-flag on quiet collector days).
 */
export function validateNarrativeScore(
  narrative: { score: number; label: string },
  signals: {
    change_7d_pct: number;
    etf_flows_30d_z_score: number | null;
    funding_rate_30d_percentile: number | null;
  },
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const z = signals.etf_flows_30d_z_score;
  const fp = signals.funding_rate_30d_percentile;

  // Skip when anchors are missing — half-anchored validation false-flags too
  // often on quiet collector days. Fail open rather than fail loud.
  if (z === null && fp === null) return violations;

  const change7d = signals.change_7d_pct;
  const dirComponent = Math.sign(change7d) * Math.min(Math.abs(change7d) * 4, 30);
  const etfComponent = z !== null ? Math.max(-100, Math.min(100, z * 40)) : 0;
  const fundingComponent = fp !== null ? ((fp - 50) / 50) * 20 : 0;
  const suggested = Math.max(
    -100,
    Math.min(100, dirComponent + etfComponent + fundingComponent),
  );
  const tolerance = 25;
  const drift = Math.abs(narrative.score - suggested);
  if (drift > tolerance) {
    const direction = narrative.score - suggested > 0 ? "less bullish" : "less bearish";
    violations.push({
      kind: "narrative_score_drift",
      field: "narrative_consensus.score",
      phrase: `${narrative.score}`,
      reason: `narrative_consensus.score=${narrative.score} but anchored signals (7d=${change7d.toFixed(2)}%, ETF z=${z?.toFixed(2) ?? "n/a"}, funding pct=${fp?.toFixed(0) ?? "n/a"}) suggest ${Math.round(suggested)} (±${tolerance} tolerance). Move the score ${direction} so it tracks today's data.`,
    });
  }
  return violations;
}

/**
 * Anti-hallucination validator for macro_context.btc_correlation_note. When
 * the note uses correlation language ("decouple", "diverge", "tracking",
 * "correlated"), it must cite a number that matches the actual 90-day rolling
 * correlation against gold or S&P 500 within ±0.05. Skips when correlations
 * are unavailable (no anchor to validate against).
 */
export function validateCorrelationNote(
  macro: { btc_correlation_note: string },
  correlations: { btc_gold_90d: number | null; btc_sp500_90d: number | null } | null,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const note = macro.btc_correlation_note;
  if (!note || note.trim().length === 0) return violations;
  if (!correlations) return violations;
  const gold = correlations.btc_gold_90d;
  const sp = correlations.btc_sp500_90d;
  if (gold === null && sp === null) return violations;

  const correlationLanguage = /\b(decoupl|diverg|track|correlat|in\s+sync|in\s+lockstep)/i;
  if (!correlationLanguage.test(note)) return violations;

  // Pull decimal numbers from the note. Correlations live in [-1, 1], so look
  // for short decimals; integers like "100" are not correlation values.
  const decimalRe = /-?\d?\.\d{1,2}/g;
  const candidates = (note.match(decimalRe) ?? [])
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n) && n >= -1 && n <= 1);

  if (candidates.length === 0) {
    violations.push({
      kind: "unsourced_correlation_claim",
      field: "macro_context.btc_correlation_note",
      phrase: note.slice(0, 100),
      reason: `btc_correlation_note uses correlation language but cites no number. The 90-day BTC-gold correlation is ${gold?.toFixed(2) ?? "n/a"} and BTC-S&P 500 is ${sp?.toFixed(2) ?? "n/a"}. Either cite the actual number or drop the correlation framing.`,
    });
    return violations;
  }

  const tolerance = 0.05;
  const matchesAny = candidates.some((c) => {
    if (gold !== null && Math.abs(c - gold) <= tolerance) return true;
    if (sp !== null && Math.abs(c - sp) <= tolerance) return true;
    return false;
  });

  if (!matchesAny) {
    const goldStr = gold !== null ? gold.toFixed(2) : "n/a";
    const spStr = sp !== null ? sp.toFixed(2) : "n/a";
    violations.push({
      kind: "unsourced_correlation_claim",
      field: "macro_context.btc_correlation_note",
      phrase: candidates.map((c) => c.toFixed(2)).join(", "),
      reason: `btc_correlation_note cites correlation values [${candidates.map((c) => c.toFixed(2)).join(", ")}] but the actual 90-day correlations are: BTC-Gold=${goldStr}, BTC-S&P=${spStr}. Quote the real number from the Correlations block (±0.05 tolerance) or drop the claim.`,
    });
  }

  return violations;
}

// ─── Hero & narrative-rationale grounding (Phase 2) ────────────────────────

/**
 * G8 — Hero earned-significance gate. When `hero_three_lines.signal` claims a
 * material/non-noise day, require at least one comparative metric to cross
 * the earned-significance threshold. Self-reported quiet-day language is
 * always exempt. Skips entirely when no anchors are available (fail-open).
 *
 * The thresholds are deliberately conservative: a +1.0σ ETF flow is real
 * institutional appetite, a 35-percentile gap from neutral funding is a real
 * positioning shift, a ±15-point F&G change is a real sentiment break. If
 * the signal claims "Material" with none of these crossed, it is manufactured
 * significance.
 */
export function validateHeroEarnedSignificance(
  hero: { move?: string; signal?: string; watch?: string } | undefined,
  market: {
    price: { change_24h_pct: number; change_7d_pct: number };
    comparative?: {
      etf_flows_30d_z_score: number | null;
      funding_rate_30d_percentile: number | null;
      fear_greed_30d_change: number | null;
      price_vs_30d_avg_pct: number | null;
    } | null;
  },
  dayClassification?: { label: string } | null,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const signal = hero?.signal ?? "";
  if (!signal) return violations;

  const materialRe = /\b(not\s+noise|material|risk\s+rose|risk\s+changed|near[\s-]term\s+risk|shifted\s+today)\b/i;
  if (!materialRe.test(signal)) return violations;

  // Self-reported quiet/flat framing is always honest; do not flag.
  const quietRe = /\b(noise|quiet|flat|under\s+the\s+surface|nothing\s+structural)\b/i;
  if (quietRe.test(signal)) return violations;

  const comp = market.comparative ?? null;
  const anchors: Array<{ name: string; satisfied: boolean }> = [];

  if (comp?.etf_flows_30d_z_score != null) {
    anchors.push({
      name: `|ETF z-score|≥1.0 (today=${comp.etf_flows_30d_z_score.toFixed(2)}σ)`,
      satisfied: Math.abs(comp.etf_flows_30d_z_score) >= 1.0,
    });
  }
  if (comp?.funding_rate_30d_percentile != null) {
    anchors.push({
      name: `funding pct distance from 50 ≥35 (today=${comp.funding_rate_30d_percentile.toFixed(0)}th)`,
      satisfied: Math.abs(comp.funding_rate_30d_percentile - 50) >= 35,
    });
  }
  if (comp?.fear_greed_30d_change != null) {
    anchors.push({
      name: `|F&G 30d change|≥15 (today=${comp.fear_greed_30d_change >= 0 ? "+" : ""}${comp.fear_greed_30d_change.toFixed(0)})`,
      satisfied: Math.abs(comp.fear_greed_30d_change) >= 15,
    });
  }
  if (comp?.price_vs_30d_avg_pct != null) {
    anchors.push({
      name: `|price vs 30d avg|≥5% (today=${comp.price_vs_30d_avg_pct.toFixed(2)}%)`,
      satisfied: Math.abs(comp.price_vs_30d_avg_pct) >= 5,
    });
  }
  anchors.push({
    name: `|24h|≥3% or |7d|≥5% (today 24h=${market.price.change_24h_pct.toFixed(2)}%, 7d=${market.price.change_7d_pct.toFixed(2)}%)`,
    satisfied:
      Math.abs(market.price.change_24h_pct) >= 3 ||
      Math.abs(market.price.change_7d_pct) >= 5,
  });
  if (
    dayClassification?.label === "risk_change" ||
    dayClassification?.label === "thesis_shift"
  ) {
    anchors.push({
      name: `day classifier label = ${dayClassification.label}`,
      satisfied: true,
    });
  }

  // Fail open if no anchors are usable at all.
  if (anchors.length === 0) return violations;
  if (anchors.some((a) => a.satisfied)) return violations;

  violations.push({
    kind: "hero_unearned_significance",
    field: "hero_three_lines.signal",
    phrase: signal.slice(0, 100),
    reason: `hero_three_lines.signal claims a material/non-noise day ("${signal.slice(0, 100)}") but no comparative metric crossed the earned-significance threshold. Anchor results: ${anchors.map((a) => `${a.name}=${a.satisfied}`).join("; ")}. Either report this honestly as a quiet day ("Under the surface: nothing structural changed") or rewrite the signal to cite a metric that actually justifies the verdict.`,
  });

  return violations;
}

/**
 * G9 — Hero sourced-claim check. Applies the same lenient anchor rule as
 * findInventedDailyDiffEvents to hero_three_lines.{move,signal,watch}.
 * Vague qualitative prose passes; specific numbers and proper nouns must
 * trace to the article corpus or today's market data.
 */
export function findHeroUnsourcedClaims(
  hero: { move?: string; signal?: string; watch?: string } | undefined,
  articles: Array<{ title: string; description?: string; content?: string }>,
  market: MarketCorpusInput,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  if (!hero) return violations;
  const articleCorpus = buildArticleCorpus(articles);
  const fullCorpus = `${articleCorpus} ${buildMarketCorpus(market)}`;

  const fields: Array<["move" | "signal" | "watch", string | undefined]> = [
    ["move", hero.move],
    ["signal", hero.signal],
    ["watch", hero.watch],
  ];
  for (const [name, text] of fields) {
    const v = checkTextHasAnchor(
      text,
      `hero_three_lines.${name}`,
      articleCorpus,
      fullCorpus,
      "hero_unsourced_claim",
    );
    if (v) violations.push(v);
  }
  return violations;
}

/**
 * G10 — Hero invented-date check. The `watch` field per the system prompt is
 * "exactly ONE upcoming catalyst with a specific date or day count". Any date
 * mention in any hero field that does not appear in the AUTHORITATIVE
 * CALENDAR or in an input article is flagged.
 */
export function findInventedHeroDates(
  hero: { move?: string; signal?: string; watch?: string } | undefined,
  calendarBlock: string,
  articles: Array<{ title: string; description?: string; content?: string }>,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  if (!hero) return violations;
  const corpus = buildDateValidationCorpus(calendarBlock, articles);

  const fields: Array<["move" | "signal" | "watch", string | undefined]> = [
    ["move", hero.move],
    ["signal", hero.signal],
    ["watch", hero.watch],
  ];
  for (const [name, text] of fields) {
    if (!text) continue;
    for (const phrase of extractDateMentions(text)) {
      if (!corpus.includes(phrase.toLowerCase())) {
        violations.push({
          kind: "hero_invented_date",
          field: `hero_three_lines.${name}`,
          phrase,
          reason: `hero_three_lines.${name} cites date "${phrase}" but that date is not in the AUTHORITATIVE CALENDAR or any source article. Replace with a date from the calendar block (closest scheduled FOMC/CPI/PCE/Jobs/options-expiry) or remove the dated claim.`,
        });
      }
    }
  }
  return violations;
}

/**
 * G11 — Narrative rationale anchor check. The 2-3 sentences under "BTC Today
 * read" must reference at least one of: (a) a comparative metric phrase
 * ("z-score", "30-day average", "percentile", "F&G", "ETF flows", "funding
 * rate"), (b) a number that matches today's market data, or (c) a proper
 * noun present in the article corpus. Vague-only rationales fail by design;
 * the prompt at synthesizer.ts already bans hedging; this validator enforces.
 */
export function validateNarrativeRationale(
  narrative: { rationale: string },
  articles: Array<{ title: string; description?: string; content?: string }>,
  market: MarketCorpusInput,
): AccuracyViolation[] {
  const violations: AccuracyViolation[] = [];
  const text = narrative.rationale ?? "";
  if (!text || text.trim().length === 0) return violations;

  const articleCorpus = buildArticleCorpus(articles);
  const fullCorpus = `${articleCorpus} ${buildMarketCorpus(market)}`;

  // (a) Comparative metric phrase — the rationale's whole job is to
  // substantiate the verdict, so a quantitative metric reference earns it.
  const metricPhraseRe = /\b(z[-\s]?score|σ|sigma|standard\s+deviation|30[-\s]?day\s+(?:average|avg|mean|high|low)|percentile|fear\s*(?:&amp;|&|and)\s*greed|f&g|funding\s+(?:rate|percentile)|etf\s+flows?|on[-\s]?chain|hash\s*rate|realized\s+vol)/i;
  if (metricPhraseRe.test(text)) return violations;

  // (b) Number from today's market data.
  const numbers = text.match(NUMBER_PATTERN) ?? [];
  if (numbers.some((n) => fullCorpus.includes(n.toLowerCase()))) return violations;

  // (c) Proper noun present in articles.
  const properNouns = text.match(PROPER_NOUN_PATTERN) ?? [];
  if (properNouns.some((pn) => articleCorpus.includes(pn.toLowerCase()))) return violations;

  violations.push({
    kind: "rationale_unanchored",
    field: "narrative_consensus.rationale",
    phrase: text.slice(0, 100),
    reason: `narrative_consensus.rationale ("${text.slice(0, 100)}") contains no comparative metric reference, no number from today's market data, and no proper noun present in source articles. Rewrite to cite a specific signal (e.g., ETF flow z-score, funding percentile, F&G delta) or a named entity from a source article. Vague hedging is banned by the system prompt.`,
  });

  return violations;
}

/**
 * Earned-significance gate for the Analyst Agent's `risk_changed_today`.
 *
 * The schema enforces that risk_changed_today is a boolean and that
 * risk_change_evidence is an array, but it cannot see the market data. This
 * validator checks the substantive rule from agents/analyst-agent.md:78:
 * risk_changed_today = true is only valid when at least one comparative
 * metric crossed a threshold today.
 *
 * Thresholds (any one is sufficient):
 *   - |ETF flow z-score| >= 1.0
 *   - funding_rate_30d_percentile >= 90 OR <= 10
 *   - |fear_greed_30d_change| >= 15 points
 *   - |price_vs_30d_avg_pct| >= 5
 *   - |24h change| >= 3% OR |7d change| >= 5%
 *   - realized_vol_30d_pct vs 90d jumped >50%
 *   - day_classifier label is "risk_change" or "thesis_shift"
 *
 * The mirror failure mode — analyst said risk_changed_today = false when a
 * threshold did cross — is NOT a violation. Honest understatement is fine;
 * the failure mode this gate exists for is fabricated risk-change framing on
 * quiet days, which would silently break the briefing's two-question contract.
 *
 * Pure function. Returns empty array when:
 *   - risk_changed_today is false (nothing to validate)
 *   - market is null (no data to compare against — analyst handled that
 *     case in its own fallback path; not the validator's concern)
 */
export function validateAnalystRiskChangeEarned(
  analysis: AnalysisBlock,
  market: MarketCollectorOutput | null,
  dayClassification: DayClassification | null,
): AccuracyViolation[] {
  if (!analysis.risk_changed_today) return [];
  if (!market) return [];

  const comp = market.comparative;
  const change24h = market.price.change_24h_pct;
  const change7d = market.price.change_7d_pct;

  const thresholdsCrossed: string[] = [];

  if (comp?.etf_flows_30d_z_score != null && Math.abs(comp.etf_flows_30d_z_score) >= 1.0) {
    thresholdsCrossed.push(`|ETF z-score|=${comp.etf_flows_30d_z_score.toFixed(2)}`);
  }
  if (
    comp?.funding_rate_30d_percentile != null &&
    (comp.funding_rate_30d_percentile >= 90 || comp.funding_rate_30d_percentile <= 10)
  ) {
    thresholdsCrossed.push(`funding pct=${comp.funding_rate_30d_percentile.toFixed(0)}`);
  }
  if (comp?.fear_greed_30d_change != null && Math.abs(comp.fear_greed_30d_change) >= 15) {
    thresholdsCrossed.push(`F&G change=${comp.fear_greed_30d_change.toFixed(0)}`);
  }
  if (comp?.price_vs_30d_avg_pct != null && Math.abs(comp.price_vs_30d_avg_pct) >= 5) {
    thresholdsCrossed.push(`price vs 30d avg=${comp.price_vs_30d_avg_pct.toFixed(1)}%`);
  }
  if (Math.abs(change24h) >= 3) {
    thresholdsCrossed.push(`|24h|=${Math.abs(change24h).toFixed(2)}%`);
  }
  if (Math.abs(change7d) >= 5) {
    thresholdsCrossed.push(`|7d|=${Math.abs(change7d).toFixed(2)}%`);
  }
  if (
    comp?.realized_vol_30d_pct != null &&
    comp.realized_vol_90d_pct != null &&
    comp.realized_vol_90d_pct > 0 &&
    comp.realized_vol_30d_pct / comp.realized_vol_90d_pct >= 1.5
  ) {
    thresholdsCrossed.push(
      `realized vol jump 30d/90d=${(comp.realized_vol_30d_pct / comp.realized_vol_90d_pct).toFixed(2)}x`,
    );
  }
  if (
    dayClassification?.label === "risk_change" ||
    dayClassification?.label === "thesis_shift"
  ) {
    thresholdsCrossed.push(`day_classifier label=${dayClassification.label}`);
  }

  if (thresholdsCrossed.length === 0) {
    return [
      {
        kind: "analyst_risk_change_unearned",
        field: "analysis.risk_changed_today",
        phrase: "risk_changed_today=true",
        reason:
          "Analyst marked risk_changed_today=true but no earned-significance threshold crossed today. Set risk_changed_today=false and clear risk_change_evidence. Required: at least one of |ETF z|>=1.0, funding pct >=90 or <=10, |F&G change|>=15, |price vs 30d|>=5%, |24h|>=3%, |7d|>=5%, realized-vol jump >=1.5x, or day_classifier label in {risk_change, thesis_shift}.",
      },
    ];
  }

  return [];
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
