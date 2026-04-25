# Scraper Agent

## Identity
Comprehensive data collector. Hits every external source the briefing depends on, normalizes outputs, and emits a single structured payload (`ScraperOutput`) consumed downstream by the Analyst.

## Pipeline position
First stage. Runs in parallel sub-tasks via `batch.triggerAndWait()`. Replaces the current sequence `news collector → market collector → triage → perplexityCrossRef → mergeTriageWithCrossRef → Jina scrape` with one named agent that orchestrates them.

```
[1] Scraper Agent (this) → ScraperOutput
[2] Analyst Agent
[3] Synthesizer Agent
```

## Input contract
```ts
interface ScraperInput {
  date: string;       // ISO YYYY-MM-DD
  windowDays?: number; // history window for derived comparatives, default 90
}
```

## Output contract
```ts
interface ScraperOutput {
  // News surface (existing behavior preserved)
  articles: RawArticle[];                  // BTC-relevance-filtered, deduped
  triage: TriageItem[];                    // 1-10 importance with reasoning
  cross_ref: PerplexityCrossRefItem[];     // Perplexity-found stories
  scraped_full_text: Record<string, string>; // url → Jina full text

  // Market surface (existing market.ts output, unchanged shape)
  market: MarketCollectorOutput;

  // Optional extensions (Phase 2 of this agent — see Required Functions)
  on_chain?: {
    exchange_reserves_btc: number | null;
    long_term_holder_supply_pct: number | null;
    realized_cap_usd: number | null;
    source_urls: string[];
  } | null;
  social_signals?: {
    twitter_volume_24h_z_score: number | null;
    sentiment_label: "bullish" | "bearish" | "neutral";
    notable_threads: Array<{ url: string; summary: string }>;
  } | null;

  // Source health (per-source availability map, used by Analyst to weight)
  sources: Record<string, "ok" | "stale" | "missing">;
}
```

## Behavior
1. Fan out collectors via `batch.triggerAndWait()`:
   - `newsCollector` → `articles[]` (SearchAPI + RSS, BTC-relevance regex, normalized-URL dedup)
   - `marketCollector` → `MarketCollectorOutput` (18 parallel APIs, comparative baselines computed inline)
2. Run triage (Claude 1-10 score) and Perplexity cross-ref **in parallel** via a single `triageAndCrossRef` task.
3. Merge triage + cross-ref outputs. For top N (default 10), Jina-scrape full text non-fatally.
4. (Optional Phase-2 extensions) Run on-chain scraper + social-signal scraper in parallel.
5. Emit `ScraperOutput` with a `sources` map noting which sources returned `ok`/`stale`/`missing`.

## Required functions
All already exist in [src/trigger/lib/](../src/trigger/lib/) and [src/trigger/collectors/](../src/trigger/collectors/):

- `newsCollector.run()` — [src/trigger/collectors/news.ts](../src/trigger/collectors/news.ts)
- `marketCollector.run()` — [src/trigger/collectors/market.ts](../src/trigger/collectors/market.ts)
- `triageTask.run()` — [src/trigger/processors/triage.ts](../src/trigger/processors/triage.ts)
- `perplexityCrossRefTask.run()` — same file
- `scrapeArticlesViaJina()` — [src/trigger/lib/jina.ts](../src/trigger/lib/jina.ts)
- `fetchWithTimeout()` — [src/trigger/lib/fetch-timeout.ts](../src/trigger/lib/fetch-timeout.ts)

**New wrappers needed** (Phase-2 extensions only, optional):
- `fetchOnChainSnapshot()` — direct Glassnode / CryptoQuant API wrappers (today these come via Perplexity in enrichment; moving them to deterministic API calls reduces hallucination risk).
- `fetchSocialSignals()` — Twitter API (or Nitter scrape) for 24h volume z-score + sentiment proxy.

## Failure modes
- **Per-source soft fail**: any single API failure → `sources[name] = "missing"`, continue. Pipeline never blocks on one collector.
- **Triage fail**: fall back to top-10-by-recency from `articles[]`. Mark `triage = []` and let Analyst infer.
- **Hard fail (block downstream)**: only when `market.price.usd` is unavailable. Without price, Analyst has nothing to anchor to.

## Cost & latency
- Today's path: ~30-45s, ~$0.05 in API spend (Claude triage + Perplexity cross-ref + Jina).
- Phase-2 extensions add ~10s + $0.02 (on-chain APIs are cheap; social scraping is the cost driver).

## Out of scope
- No analytical reasoning. Scraper does not classify regime, score sentiment beyond mechanical metrics, or write prose. That's the Analyst's job.
- No source-URL filtering for institutional / expert / supply enrichment data. That stays in [enrichment.ts](../src/trigger/processors/enrichment.ts) where the source-URL gates already live.
