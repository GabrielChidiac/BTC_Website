# Analyst Agent

## Identity
The institutional-grade market analyst. Reads Scraper output, the EXPERT_CONTEXT prior, and the comparative baselines, and emits a tight structured `AnalysisBlock` consumed by the Synthesizer. Optimized for **analytical depth**, not for voice — the analyst writes for itself, not the reader. The Synthesizer translates its output into the briefing voice.

## Pipeline position
**NEW** stage. Inserted between Scraper and the Synthesizer (the renamed AI Brain). Today's AI Brain currently mixes analysis and voice in one Claude call; this agent extracts the analysis half so the Synthesizer can focus on voice + structure.

```
[1] Scraper Agent → ScraperOutput
[2] Analyst Agent (this) → AnalysisBlock
[3] Synthesizer Agent (uses AnalysisBlock + ScraperOutput) → BriefingJSON
```

## Why this exists
Today's AI Brain prompt is ~400 lines and tries to do three things at once: analyze the market state, decide what to surface, and write user-facing JSON. Splitting analysis out has three benefits:

1. **Tighter prompt per role.** Analyst can use a maximally analytical system prompt with no voice constraints. Synthesizer gets a clean voice prompt with the analysis already done.
2. **Independent A/B testing.** Tune analytical depth without risking voice regressions. Tune voice without breaking analytical guardrails.
3. **Different model per stage** (future option). Use Opus for analysis (expensive, deep), Haiku for synthesis (cheap, formatting). Today both run on Sonnet; structure enables the choice later.

## Input contract
```ts
interface AnalystInput {
  date: string;
  scraper: ScraperOutput;        // from Scraper Agent
  yesterday_briefing: BriefingJSON | null; // for daily_diff anchoring
  day_classification: DayClassification | null; // from existing day-classifier.ts
}
```

## Output contract
```ts
interface AnalysisBlock {
  // High-level verdicts (Synthesizer translates into hero + narrative_consensus)
  regime: "risk_on" | "risk_off" | "consolidation" | "transition" | "decoupling";
  conviction: number; // 0-100, certainty in the regime call
  one_line_thesis: string; // single sentence, internal voice (not user-facing)

  // Drivers (Synthesizer fills top_stories + daily_diff.key_changes from these)
  primary_drivers: Array<{
    driver: string; // "ETF accumulation", "macro repricing", "supply tightening"
    direction: "bullish" | "bearish" | "neutral";
    magnitude: "strong" | "moderate" | "weak";
    evidence: string[]; // 2-4 specific facts from scraper data
  }>;

  // Technical posture (Synthesizer fills technical_signals.signal_summary)
  technical_posture: {
    rsi_read: "overbought" | "neutral" | "oversold";
    sma_alignment: "bullish_cross" | "bearish_cross" | "above_both" | "below_both" | "between";
    structure: "trending_up" | "trending_down" | "ranging" | "breakout_attempt";
    key_level: { price: number; type: "support" | "resistance"; significance: string };
  };

  // Macro context (Synthesizer fills macro_context.narrative + .btc_correlation_note)
  macro_assessment: {
    fed_path_pricing: string; // 1 sentence; must cite calendar block events only
    correlation_state: { gold: number | null; sp500: number | null; interpretation: string };
    fiscal_or_dollar_note: string; // 1 sentence, cite a real number or omit
  };

  // Risk surface (Synthesizer feeds this into hero_three_lines.signal earnedness)
  risk_changed_today: boolean;
  risk_change_evidence: string[]; // empty if risk_changed_today = false

  // Analyst confidence + caveats (Synthesizer uses to calibrate hedging in voice)
  confidence_caveats: string[];
  data_gaps: string[]; // sources marked "missing" in ScraperOutput.sources
}
```

## System prompt outline
- Frame: "You are a senior macro-financial analyst at a multi-strategy fund. You write for an internal investment-committee memo, not for retail."
- Anchor to data: every claim must cite a number from the scraper's market block, an entity from the news block, or a calendar event. No training-data priors.
- Closed vocabulary for `regime`, `direction`, `magnitude`, `structure`, `rsi_read`, `sma_alignment` — schema-validated.
- Inject `EXPERT_CONTEXT_DIGEST` ([src/trigger/processors/expert-context.ts](../src/trigger/processors/expert-context.ts)) as analytical priors. Use them where they fit; never force-fit.
- Earned-significance rule (mirrors hero G8): `risk_changed_today = true` is only valid if at least one comparative metric crossed a threshold (|ETF z|≥1.0, funding pct gap≥35, |F&G change|≥15, |price vs 30d|≥5%, |24h|≥3% or |7d|≥5%, or day_classifier ∈ {risk_change, thesis_shift}).
- Return ONLY valid JSON matching the AnalysisBlock zod schema.

## Required functions
- `callClaudeJSON<AnalysisBlock>()` with `schema: AnalysisBlockSchema`, `retryOnSchemaError: true` — already in [src/trigger/lib/anthropic.ts](../src/trigger/lib/anthropic.ts).
- `EXPERT_CONTEXT_DIGEST` — [src/trigger/processors/expert-context.ts](../src/trigger/processors/expert-context.ts)
- `buildCountdownFactsBlock(date, 90)` — [src/trigger/lib/calendar.ts](../src/trigger/lib/calendar.ts)
- `MarketCollectorOutput.comparative` baselines — already on `ScraperOutput.market.comparative`

**New zod schema needed** in [src/lib/schemas.ts](../src/lib/schemas.ts):
- `AnalysisBlockSchema` — closed-set unions on `regime`, `direction`, etc.; numeric ranges for `conviction`, `correlation_state.{gold,sp500}`.

**New type** in [src/lib/types.ts](../src/lib/types.ts):
- `AnalysisBlock` matching the schema.

## Failure modes
- **Schema retry exhausted**: ship a fallback `AnalysisBlock` derived deterministically from market data only (regime = "consolidation" if |7d| < 2%, "risk_on" / "risk_off" by sign of |7d|, conviction = 30, drivers = empty array). Synthesizer must handle empty `primary_drivers`.
- **Anthropic + Kie.ai both 5xx**: same fallback as schema-retry-exhausted. Mark `confidence_caveats: ["analyst_unavailable_data_only_brief"]` so Synthesizer can shorten depth.
- **Validators fire post-Synthesis citing analyst hallucinations**: handled by the existing `ensureDataConsistency` retry harness; Analyst output is fed back into the repair prompt as data, not regenerated.

## Cost & latency
- Adds ~30-45s per pipeline run (one Claude call, JSON-mode, ~3-4k input tokens, ~1-2k output tokens).
- Adds ~$0.05 per run in Claude tokens. Daily pipeline: +$1.50/month.

## What "PhD-level" actually means here
Honest framing: calling a Claude call "PhD-level" doesn't make it better — the prompt does. What gives this agent genuine analytical depth:
1. **Closed-vocabulary outputs** prevent vague hedging ("markets are uncertain"). Force a regime call, force a conviction number.
2. **EXPERT_CONTEXT prior** provides 2,500 words of analytical framework (Lyn Alden / Jeff Park / Saylor lens).
3. **Comparative baselines required** for every quantitative claim — anchored to real numbers, not vibes.
4. **Earned-significance gate** at the analytical layer, not just the voice layer — analyst cannot say "risk changed" without a metric crossing.
5. **Separation from voice** — analyst is not under prose-length pressure, can think structurally without composing sentences.

That combination — closed schema + analytical priors + numeric anchors + earned-significance gate + freedom from voice constraints — is what produces analytical depth. "PhD-level" is the marketing label; this is the substance.

## Out of scope
- No reader-facing prose. Output fields are internal-voice; the Synthesizer translates.
- No source-URL gating. That stays in enrichment for institutional / expert / supply data.
- No editorial decisions about which stories to surface in the briefing — that's the Synthesizer's job, informed by `primary_drivers`.
