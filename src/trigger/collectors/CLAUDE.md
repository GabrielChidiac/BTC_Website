# src/trigger/collectors/CLAUDE.md

Scoped guidance for collectors. See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for pipeline orchestration.

## Scope
External-API gatherers that produce raw inputs for the rest of the pipeline. Run in parallel via `batch.triggerAndWait()`.

## Files
- [news.ts](news.ts) — SearchAPI + RSS aggregation. Filters by BTC-relevance regex, dedupes by normalized URL (lowercase, trimmed). Returns `NewsCollectorOutput { articles: RawArticle[] }`.
- [market.ts](market.ts) — 18 parallel API calls fanning out across price, ETF flows, funding, F&G, network, comparisons. Returns `MarketCollectorOutput`. Computes derived comparative baselines (realized vol, z-scores, percentiles) inline.

## Conventions
- Every collector is **fail-soft per source**. A missing data source must degrade gracefully — never bring down the pipeline.
- Use `fetchWithTimeout` from [../lib/fetch-timeout.ts](../lib/fetch-timeout.ts) for all outbound HTTP. No raw `fetch` without a timeout.
- All upstream wrappers live in [../lib/](../lib/) (coingecko.ts, sosovalue.ts, alternativeme.ts, mempool.ts, funding-rate.ts, comparison.ts, correlation.ts, searchapi.ts, rss.ts, jina.ts). Collectors orchestrate them; they do not call external APIs directly.
- Collectors use `Promise.allSettled` internally to run multiple sources in parallel and unwrap individual failures.
- Track per-source availability in a `sources` map and log a summary at the end of the task.

## What goes in collectors vs lib
- **lib/**: a single API wrapper that fetches and validates one upstream source.
- **collectors/**: orchestration of multiple wrappers + derived computations on the combined data.

## Anti-patterns
- No analysis or AI calls in collectors. Collectors return data; AI lives in `processors/`.
- No throwing on missing data. Return null for absent fields and log at warn level.
