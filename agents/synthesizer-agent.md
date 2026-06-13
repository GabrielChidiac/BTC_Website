# Synthesizer Agent

## Identity
The voice + structure layer. Takes `ScraperOutput` + `AnalysisBlock` and produces the final user-facing `BriefingJSON`. Inherits today's AI Brain role but with the analytical work already done by the Analyst — frees this agent to focus exclusively on voice, structure, and the reader contract.

## Pipeline position
Third stage. Replaces (in role) the current AI Brain at [src/trigger/processors/ai-brain.ts](../src/trigger/processors/ai-brain.ts). The validator harness `ensureDataConsistency` and the headline-overwrite logic stay attached to this agent unchanged.

```
[1] Scraper Agent → ScraperOutput
[2] Analyst Agent → AnalysisBlock
[3] Synthesizer Agent (this) → BriefingJSON
[4] Enrichment + market-signals + save + distribute (downstream, unchanged)
```

## Input contract
```ts
interface SynthesizerInput {
  date: string;
  scraper: ScraperOutput;
  analysis: AnalysisBlock;
  yesterday_briefing: BriefingJSON | null;
  day_classification: DayClassification | null;
}
```

## Output contract
`BriefingJSON` (see [src/lib/types.ts](../src/lib/types.ts)) **minus** the four enrichment fields (`looking_ahead`, `institutional_flows`, `supply_dynamics`, `expert_insights`) which are filled by the unchanged enrichment task downstream. ETF flows, funding rate, F&G, correlations come straight from market collector data — Synthesizer copies them through.

## Behavior
1. Read the structured `analysis.regime` + `analysis.primary_drivers` + `analysis.technical_posture` + `analysis.macro_assessment` and translate them into:
   - `narrative_consensus` (label, score anchored to analysis.conviction, rationale citing drivers)
   - `daily_diff.{price_change, sentiment_shift, key_changes}` (sentiment_shift answers "did anything change near-term risk?" using `analysis.risk_changed_today`)
   - `hero_three_lines.{move, signal, watch}` (signal earnedness gated by `analysis.risk_changed_today`)
   - `macro_context.{narrative, btc_correlation_note, key_macro_events}`
   - `technical_signals.signal_summary`
2. Pick the top 5 stories from `scraper.articles[]` ranked using `analysis.primary_drivers` as a guide (combined cap across `top_stories + regulatory + adoption`, allocated by importance).
3. Overwrite every `headline` field with the verbatim `RawArticle.title`. Synthesizer cannot editorialize headlines by architecture.
4. Generate `looking_ahead_predictions` (2-3 testable directional claims) from `analysis.primary_drivers` + calendar block.
5. Run all 12 accuracy validators via `ensureDataConsistency` (existing). One correction retry on violations; ship better-of-two.
6. Return the partial `BriefingJSON`; downstream enrichment fills the four enrichment fields, market-signals adds callouts, save publishes.

## System prompt outline
- Frame: "You write the briefing for busy BTC holders. The analyst has already decided what today means; your job is to translate that into the briefing voice without adding analytical claims of your own."
- Voice rules (preserved from current AI Brain): peer-to-peer with a professional adult, no hype, no Crypto Twitter, no em dashes, plain English with comparative anchors.
- Structural rules (preserved): 5-item combined cap across stories/regulatory/adoption; 3-Minute Contract hero; two-question reader contract.
- Earned significance: deferred to the Analyst — Synthesizer trusts `analysis.risk_changed_today` and writes the hero accordingly.
- Anti-hallucination: every quantitative claim must trace to scraper market data or article content. The 12 validators enforce this post-generation.

## Required functions
All exist today in the AI Brain implementation; refactor in place rather than reimplementing:

- `callClaudeJSON<BriefingJSON>()` with `schema: AiBrainOutputSchema` — [src/trigger/lib/anthropic.ts](../src/trigger/lib/anthropic.ts)
- `ensureDataConsistency()` retry harness — [src/trigger/processors/ai-brain.ts:828](../src/trigger/processors/ai-brain.ts) (12 validators chained)
- `dedupeBriefingStories()` — [src/lib/dedupe-stories.ts](../src/lib/dedupe-stories.ts)
- `validateCountdownEvents()` — [src/trigger/lib/calendar.ts](../src/trigger/lib/calendar.ts)
- `buildFallbackBriefing()` — [src/trigger/processors/fallback-template.ts](../src/trigger/processors/fallback-template.ts) (used when both Synthesizer and Analyst fail)
- All 12 accuracy validators — [src/trigger/lib/accuracy-validators.ts](../src/trigger/lib/accuracy-validators.ts)

**No new wrappers needed.** This agent is a refactor of existing code, not new infrastructure.

## Failure modes
- **Schema retry exhausted**: fall back to `buildFallbackBriefing()` with `analysis` available — produces a data-derived briefing that uses the analyst's regime call and drivers as a skeleton, no AI prose. Mark `fallback_used: true` so the email + homepage show the editor's note.
- **Both Analyst and Synthesizer fail**: hard-fall to existing fallback template (no analyst input). Today's behavior preserved.
- **Validators fire**: existing `ensureDataConsistency` single-retry handles this; ship better-of-two as today.

## Cost & latency
- Roughly equivalent to today's AI Brain: ~30-60s, ~$0.10 per run + ~$0.10 on retry firing. **No additional cost.** The architectural change does not multiply Synthesizer cost; it relocates analytical work to a cheaper, more focused stage (Analyst).

## How this differs from today's AI Brain
| Concern | Today's AI Brain | New Synthesizer |
|---|---|---|
| What it generates | Full BriefingJSON + analytical reasoning inline | Full BriefingJSON, analytical reasoning consumed from AnalysisBlock |
| System prompt focus | Analysis + voice + structure (~400 lines) | Voice + structure only (~250 lines target) |
| Retry harness | ensureDataConsistency with 12 validators | Same |
| Headline overwrite | Yes | Yes |
| Earned significance | Prompt rule + G8 validator | Trusts `analysis.risk_changed_today` + G8 validator (belt-and-suspenders) |
| Analytical depth | Bounded by what fits inside one prompt | Higher — Analyst already did the deep work |
| Coherence | Native (one call) | Preserved (Synthesizer is still one call; only the analytical pre-step is split) |

## Migration plan
1. Implement Analyst Agent as new task at `src/trigger/processors/analyst.ts`.
2. Rename `aiBrainTask` → `synthesizerTask`. Tighten its prompt to remove analytical-reasoning sections (move them to Analyst).
3. Add `analyst` step to `daily-pipeline.ts` between scraper-stage and synthesizer-stage.
4. Update `daily-pipeline.ts` to pass `analysis` into Synthesizer's payload.
5. Run side-by-side for 3-5 days against fixtures; compare BriefingJSON outputs to detect regressions.
6. Cut over once validator firing rate is stable.

## Out of scope
- The 12 accuracy validators stay where they are. Refactor target is the prompt, not the validators.
- The enrichment task and its source-URL gates stay unchanged.
