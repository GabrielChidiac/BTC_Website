# src/trigger/lib/CLAUDE.md

Scoped guidance for pipeline lib. See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for pipeline orchestration.

## Scope
Single-purpose utilities used by collectors, processors, publishers, and audio-brief. Each file wraps one external API or one piece of logic. **Pure / side-effect-free / `Result<T>` return.**

## API wrappers (all return `Result<T>`, all use `fetchWithTimeout`, none throw)
- [anthropic.ts](anthropic.ts) — `callClaudeJSON<T>()` with chain Anthropic SDK → Kie.ai on 429/5xx → parse → optional `schema` (zod) validation → optional `retryOnSchemaError` correction retry.
- [perplexity.ts](perplexity.ts) — `queryPerplexity({ system, prompt })` against `sonar-pro`.
- [openai-tts.ts](openai-tts.ts) — `gpt-4o-mini-tts` with `ash` voice + `VOICE_INSTRUCTIONS` steering block. **120 WPM target.**
- [coingecko.ts](coingecko.ts), [sosovalue.ts](sosovalue.ts), [alternativeme.ts](alternativeme.ts), [mempool.ts](mempool.ts), [funding-rate.ts](funding-rate.ts) — single-vendor wrappers.
- [comparison.ts](comparison.ts) — S&P 500, NASDAQ, Gold, DXY, ETH, SOL via Yahoo Finance.
- [correlation.ts](correlation.ts) — 90-day rolling correlation matrix from price series.
- [searchapi.ts](searchapi.ts), [rss.ts](rss.ts) — news feeds.
- [jina.ts](jina.ts) — Jina Reader full-text article scrape.
- [technical-indicators.ts](technical-indicators.ts) — RSI-14, SMA-50, SMA-200, support/resistance from `trading-signals`.
- [fetch-timeout.ts](fetch-timeout.ts) — `fetchWithTimeout()`, `withTimeout()`. Use everywhere outbound HTTP happens.
- [alert.ts](alert.ts) — internal alerting helper.

## Accuracy infrastructure
[accuracy-validators.ts](accuracy-validators.ts) — twelve runtime validators chained inside `ensureDataConsistency` in [../processors/synthesizer.ts](../processors/synthesizer.ts), plus `validateAnalystRiskChangeEarned` consumed by [../processors/analyst.ts](../processors/analyst.ts). All validators are **pure functions** (no I/O, no logging). They take a briefing or analysis subset + market data + (where needed) calendar block + articles, and return `AccuracyViolation[]`.

Shared helpers at module scope:
- `NUMBER_PATTERN`, `PROPER_NOUN_PATTERN`, `MONTH_FULL`, `MONTH_ABBR`
- `buildMarketCorpus`, `buildArticleCorpus`, `buildDateValidationCorpus`, `extractDateMentions`, `checkTextHasAnchor`

When adding a new validator: reuse helpers, return `AccuracyViolation[]`, do not log inside the function (the caller logs aggregate counts).

## Calendar
[calendar.ts](calendar.ts) — deterministic schedule of FOMC, CPI, PCE, Jobs, halving, options-expiry. Manually curated dates from official sources (Fed, BLS, BEA). The countdown_events validator drops anything not present here. **Verify dates ≥ once/year**; comment block at file top has the source URLs.

## Conventions
- Every wrapper returns `Result<T> = { data: T; error: null } | { data: null; error: string }`. **Never throw.**
- Use `fetchWithTimeout` from [fetch-timeout.ts](fetch-timeout.ts) for all outbound HTTP.
- No axios, no fetch libraries. Native `fetch` only.
- Validators are pure functions — no I/O, no `logger` calls inside.

## Anti-patterns
- No `axios`.
- No throwing from API wrappers.
- No logging inside validators (the caller logs aggregate stats).
- No state on module scope beyond regexes / constants — wrappers are stateless.
