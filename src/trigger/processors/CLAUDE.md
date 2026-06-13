# src/trigger/processors/CLAUDE.md

Scoped guidance for processors. See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for pipeline orchestration.

## Scope
The "brain" of the pipeline. Transforms collector output into the BriefingJSON via a mix of Claude calls, Perplexity calls, and deterministic rules.

## Files
- [triage.ts](triage.ts) — Claude call. Scores news 1-10 with three pre-gates (direct mechanism, historical precedent ≥2% in 7d, Bitcoin-primary). Returns `TriageOutput { ranked: TriageItem[] }`. Score is a *signal* to the Synthesizer, not a hard filter.
- [day-classifier.ts](day-classifier.ts) — Claude call. Returns `DayClassification { label, depth_weight, day_tone_line }`. Reads last 7 days for historical smoothing. Feeds the Synthesizer as `dayContext`. **Load-bearing.**
- [analyst.ts](analyst.ts) — Claude call. NEW pre-step (between day-classifier and Synthesizer). Returns `AnalysisBlock { regime, conviction, primary_drivers, technical_posture, macro_assessment, risk_changed_today, ... }`. Closed-vocabulary internal-voice analytics for the Synthesizer to translate. Earned-significance gate enforced via `validateAnalystRiskChangeEarned` with one correction retry. Failure returns a deterministic data-derived fallback. **Currently passed to Synthesizer as telemetry only — prompt does not yet consume it (side-by-side validation phase).**
- [synthesizer.ts](synthesizer.ts) — **Source of truth for briefing voice.** The system prompt at the top is canonical; read it before changing briefing behavior. Generates BriefingJSON. Hosts `ensureDataConsistency` retry harness that chains all 11 accuracy validators. Trigger.dev task `id: "synthesizer"` (renamed from "ai-brain" 2026-04-25). Receives `analysisContext?: AnalysisBlock` for telemetry — not yet consumed by the prompt.
- [expert-context.ts](expert-context.ts) — `EXPERT_CONTEXT` (~2500 words) and `EXPERT_CONTEXT_DIGEST`. Analytical priors fed to the Synthesizer + Analyst as user-prompt reference. **Edit this file to shift the briefing's analytical lens.** Never quoted verbatim by Claude.
- [enrichment.ts](enrichment.ts) — Perplexity. Runs 4 queries in parallel via `Promise.allSettled` inside ONE Trigger task: `looking_ahead`, `institutional_flows`, `expert_insights`, `supply_dynamics`. **Load-bearing fields.** Source-URL gates filter out unverifiable items.
- [market-signals.ts](market-signals.ts) — Deterministic. Reads 30-day history from Supabase. Emits at most 2 callouts (correlation regime flips, funding extremes, F&G deltas). Tuned to fire rarely; quiet days are expected.
- [fallback-template.ts](fallback-template.ts) — `buildFallbackBriefing`. Data-derived briefing with no narrative AI. Used when both Claude (Anthropic + Kie.ai) exhaust and market data is present.

## Accuracy validators
Twelve runtime validators chained in `ensureDataConsistency` ([synthesizer.ts](synthesizer.ts)). One correction retry on violations; ships better-of-two. Plus `validateAnalystRiskChangeEarned` chained inside [analyst.ts](analyst.ts) for the analyst's earned-significance gate. Validator implementations in [../lib/accuracy-validators.ts](../lib/accuracy-validators.ts) — see that file's CLAUDE.md.

## Synthesizer rules to know before editing
- 5-item combined cap across `top_stories + regulatory + adoption`. Allocated by importance, not per-section quota.
- Two-question reader contract: `daily_diff.sentiment_shift` and `hero_three_lines.signal` must plainly answer (1) is today mostly noise? (2) did anything change near-term risk?
- Earned significance: depth tracks `day_classifier.depth_weight`. Quiet days read short and flat.
- Comparative anchoring: quantitative claims must reference `market.comparative` baselines.
- Headline overwrite: Synthesizer always overwrites story/regulatory/adoption headlines with verbatim source titles. Editorialization is impossible by architecture.
- Source URLs required on enrichment writes for `expert_insights[].source_url`, `institutional_flows.notable_moves[].source_url`, `supply_dynamics.source_url`. Empty array is a valid output.

## Anti-patterns
- No `Promise.all` over `triggerAndWait`. Use `batch.triggerAndWait()` for parallel sub-tasks.
- No "padding" empty arrays in enrichment. Empty is a feature on quiet weeks.
- Never editorialize headlines; the pipeline overwrites them anyway.
- Never assume payload fields exist — every task entry normalizes `payload?.field ?? default`.
