---
name: analyst-review
description: Pull the last 5-10 daily briefings from Supabase, summarize analyst telemetry (regime distribution, conviction calibration, risk-changed firing rate, validator coercions), compare analysis_block to narrative_consensus, and emit a verdict on whether the Synthesizer prompt rewrite is ready to ship. Run via Supabase MCP. Cadence: roughly every 5 days once analyst telemetry has accumulated.
---

This skill produces the side-by-side validation report that gates the Synthesizer prompt rewrite (Phase 3 of the Analyst Agent migration in [agents/synthesizer-agent.md](../../agents/synthesizer-agent.md)). It assumes the Supabase MCP is connected and authenticated.

## When to invoke
- 5+ days have passed since the analyst was wired into the daily pipeline (first persistence: 2026-04-26 row).
- User wants to know whether to ship the prompt rewrite that has the Synthesizer consume `analysisContext` instead of doing its own analytical reasoning.
- After any change to [analyst.ts](../../src/trigger/processors/analyst.ts) prompt, schema, or earned-significance gate.

## What to query

**1. Pull the relevant rows.** Last 10 briefings, only fields needed for the report:

```sql
SELECT
  date,
  content -> 'analysis_block' AS analysis_block,
  content -> 'day_classification' ->> 'label' AS day_label,
  content -> 'narrative_consensus' ->> 'label' AS narrative_label,
  (content -> 'narrative_consensus' ->> 'score')::int AS narrative_score,
  content -> 'hero_three_lines' ->> 'signal' AS hero_signal,
  content ->> 'fallback_used' AS fallback_used,
  content ->> 'audio_duration_seconds' AS audio_seconds,
  jsonb_array_length(coalesce(content -> 'expert_insights', '[]'::jsonb)) AS expert_count,
  jsonb_array_length(coalesce(content -> 'top_stories', '[]'::jsonb)) AS top_story_count,
  jsonb_array_length(coalesce(content -> 'looking_ahead_predictions', '[]'::jsonb)) AS prediction_count
FROM daily_briefings
WHERE content ? 'analysis_block'
ORDER BY date DESC
LIMIT 10;
```

If fewer than 5 rows return, the analyst hasn't accumulated enough data yet. Tell the user that and stop.

**2. Compute the report sections.**

### Section A — Analyst output distribution
- Regime breakdown: count of `analysis_block.regime` values across the window.
- Conviction calibration: mean conviction by regime; flag if `consolidation` runs >50 (over-confident) or `risk_on/off` runs <40 (under-confident).
- `risk_changed_today` firing rate: count of `true` values. Per `agents/analyst-agent.md:78`, this should be rare on quiet weeks. Flag if >50% of days fire.
- Coercion frequency: count of rows where `analysis_block.confidence_caveats` includes `"earned_significance_gate_coerced"`. High frequency means the prompt is over-firing risk_changed_today and the validator is catching it. Investigate if >2 in 5 days.

### Section B — Synthesizer prompt rewrite readiness
This is the report's headline output. Compute:
- **Regime/narrative agreement rate.** Map `analysis_block.regime` ↔ `narrative_consensus.label`. Define agreement: `risk_on` regime should map to "Cautiously Optimistic" / "Cautious Accumulation" / similar bullish labels; `risk_off` to "Cautious Positioning" / bearish labels; `consolidation` to "Mixed / No Clear Signal" / "Cautiously Constructive" / similar. Hand-judged, not exact-match.
- **Driver/key-changes overlap.** For each row, check whether `analysis_block.primary_drivers[].driver` themes appear in the briefing's `daily_diff.key_changes`. Overlap >70% on signal days = analyst output is consistent with what the Synthesizer would have produced.
- **Verdict.** Three options:
  - **READY** — agreement >75%, coercions ≤1, no fallback days. Recommend shipping the prompt rewrite.
  - **NEEDS MORE DATA** — fewer than 5 non-fallback rows with both fields populated.
  - **NOT READY** — agreement <60%, OR coercions >2, OR analyst regime contradicts narrative_consensus.label on multiple thesis-shift days. Specify which.

### Section C — General pipeline health (5-day window)
- Fallback rate: count of `fallback_used=true`. Should be 0; >0 means Claude+Kie.ai both exhausted.
- Audio duration distribution: min/max/median `audio_duration_seconds`. Target 220-265s (3:40-4:25). Flag if any row >280s (rushed-feeling territory) or <200s (too short to deliver value).
- Enrichment empty rate: count where `expert_count=0` OR `looking_ahead` matches "unavailable". Empty is valid on quiet days; flag only if >1 day in 5.
- Top story count: should be 3-5 per the combined-cap rule. Flag rows with 0 or 1 (story-starvation) or 6+ (cap broken).

### Section D — Anomalies & open issues
Anything that looks weird but doesn't fit the categories above. Examples: predictions count dropping to 0, day_label distribution skewing away from ~70% noise, hero_signal phrasing repeating verbatim across days.

## Output format
Single concise update. No multi-section preamble. Lead with the verdict, then the 4 sections in order. Total length under ~400 words. The user reads this in 90 seconds and decides.

## Hard rules
- Do NOT recommend the prompt rewrite unless verdict is READY. The migration plan in `agents/synthesizer-agent.md:81-87` requires side-by-side validation before cutover; trust that plan.
- If MCP is disconnected, do not improvise — tell the user to re-auth the supabase MCP.
- Read-only MCP scope by design. If a query needs DDL, surface the SQL for manual execution in Supabase SQL Editor.
