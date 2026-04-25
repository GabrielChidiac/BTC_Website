# src/trigger/CLAUDE.md

Scoped guidance for the Trigger.dev pipeline. See [/CLAUDE.md](/CLAUDE.md) for global rules.

## Scope
This directory contains the daily 2 AM CET cron pipeline. The entry point is [daily-pipeline.ts](daily-pipeline.ts); subdirectories implement individual stages.

## Layout
- [collectors/](collectors/) — external-API gatherers (news + market data)
- [processors/](processors/) — AI-driven and rule-based transforms
- [publishers/](publishers/) — DB writes + email + ISR revalidation
- [lib/](lib/) — API wrappers, validators, calendar; all return `Result<T>`
- [audio-brief/](audio-brief/) — Pillar 2 audio script generation + TTS

## Orchestration rules
- Use `batch.triggerAndWait()` for parallel sub-tasks. **Never** `Promise.all` over individual `triggerAndWait` calls.
- `Promise.allSettled` inside a single task body is fine (e.g., enrichment runs 4 Perplexity queries in parallel inside one task).
- Cron `"0 1 * * *"` (1 UTC = 2 CET) runs daily-pipeline.ts. `resolve-predictions` runs separately at 03:00 UTC. `send-weekly-recap` runs Sunday 09:00 UTC.
- `maxDuration: 900` (15 min) is the global cap. Stay well under it.

## Pipeline shape
```
collectors (parallel)
  → triage + perplexityCrossRef (parallel) → mergeTriageWithCrossRef → Jina scrape
  → day-classifier (precursor)
  → analyst (NEW — produces AnalysisBlock; non-fatal, deterministic fallback)
  → Synthesizer (Claude → BriefingJSON; data-derived fallback if Claude fails)
  → enrichment (Perplexity ×4 inside one task)
  → market-signals (Postgres-backed)
  → computeReadTimeSeconds
  → audio brief
  → save (briefing + predictions) → revalidate (ISR) → send digest
```

## Fault tolerance posture
- Collectors / triage / analyst / enrichment / audio brief / market-signals: **non-fatal** — failures default to fallback values.
- Synthesizer: mostly fatal; `buildFallbackBriefing` produces a data-derived briefing when Claude exhausts. Hard-fail only if both Claude AND market data are missing.
- Publishers: sequential; if save fails, email is not sent.

## Anti-patterns
- No `Promise.all` over `triggerAndWait`.
- No `axios`; native `fetch` only.
- No throwing from API wrappers; return `Result<T>`.
- No assumptions about dashboard test payloads — every task entry normalizes `payload?.field ?? default`.
