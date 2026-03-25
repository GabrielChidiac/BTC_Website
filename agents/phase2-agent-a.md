# Phase 2 — Agent A: Data Source Wrappers

## Mission
Create 7 API wrapper files in `src/trigger/lib/`. These are plain async functions (no Trigger.dev imports) that fetch data from external sources and return `Result<T>`.

## Shared Rules
- Every function returns `Result<T>` (import from `@/lib/types`)
- Import constants from `@/lib/constants`
- Use native `fetch` for HTTP calls — no axios
- Wrap all external calls in try/catch → return `{ data: null, error: message }` on failure
- No Trigger.dev imports — these are utility functions called by collector tasks later

```typescript
import type { Result } from "@/lib/types";
// on success: return { data: ..., error: null };
// on failure: return { data: null, error: `[wrapper-name] ${e.message}` };
```

---

## File 1: `src/trigger/lib/searchapi.ts`

**Purpose:** Fetch recent Bitcoin news articles via SearchAPI.io (Google News engine).

**Imports:**
- `SEARCHAPI_BASE`, `SEARCH_QUERIES` from `@/lib/constants`
- `Result`, `RawArticle` from `@/lib/types`

**Auth:** `SEARCHAPI_KEY` env var, passed as query param `api_key`

**Function:**
```typescript
export async function fetchSearchApiNews(): Promise<Result<RawArticle[]>>
```

**Logic:**
1. For each query in `SEARCH_QUERIES`, call `GET ${SEARCHAPI_BASE}?engine=google_news&q=${query}&api_key=${key}`
2. Parse `response.news_results` — map each to `RawArticle { title, url, source, published_at, description }`
3. Merge results from both queries, deduplicate by URL
4. Return combined array

---

## File 2: `src/trigger/lib/rss.ts`

**Purpose:** Fetch articles from RSS feeds and YouTube channel RSS feeds.

**Imports:**
- `RSS_FEEDS`, `YOUTUBE_CHANNELS`, `YOUTUBE_RSS_BASE` from `@/lib/constants`
- `Result`, `RawArticle` from `@/lib/types`
- `rss-parser` npm package

**Functions:**
```typescript
export async function fetchRssArticles(): Promise<Result<RawArticle[]>>
export async function fetchYoutubeRss(): Promise<Result<{ channelName: string; videoId: string; title: string; publishedAt: string }[]>>
```

**fetchRssArticles logic:**
1. Create `new Parser()` from `rss-parser`
2. For each feed in `RSS_FEEDS`, call `parser.parseURL(feed.url)`
3. Map items to `RawArticle` — use `item.isoDate` or `item.pubDate` for `published_at`
4. Merge all, return array (don't fail if one feed errors — skip it, log warning)

**fetchYoutubeRss logic:**
1. For each channel in `YOUTUBE_CHANNELS`, fetch `${YOUTUBE_RSS_BASE}${channel.channelId}`
2. Parse with `rss-parser` — extract `yt:videoId` from each entry
3. Return array of `{ channelName, videoId, title, publishedAt }`

---

## File 3: `src/trigger/lib/youtube-transcript.ts`

**Purpose:** Fetch YouTube video transcripts with timeout and fallback.

**Imports:**
- `TRANSCRIPT_TIMEOUT_MS`, `MAX_TRANSCRIPT_WORDS` from `@/lib/constants`
- `Result`, `TranscriptResult` from `@/lib/types`
- `youtube-transcript` npm package (`YoutubeTranscript`)
- `truncateWords` from `@/lib/utils`

**Function:**
```typescript
export async function fetchTranscript(video: {
  channelName: string;
  videoId: string;
  title: string;
  publishedAt: string;
}): Promise<Result<TranscriptResult>>
```

**Logic:**
1. Try `YoutubeTranscript.fetchTranscript(videoId)` with a timeout of `TRANSCRIPT_TIMEOUT_MS` (use `AbortSignal.timeout` or `Promise.race`)
2. Join all transcript segments into one string, truncate to `MAX_TRANSCRIPT_WORDS` using `truncateWords`
3. Return `TranscriptResult` with `is_fallback: false`
4. **On failure (timeout or error):** Return a `TranscriptResult` where `transcript` = `"${title}"` and `is_fallback: true`
5. `video_url` = `https://www.youtube.com/watch?v=${videoId}`

---

## File 4: `src/trigger/lib/coingecko.ts`

**Purpose:** Fetch Bitcoin price data, market cap, exchanges, and 200-day historical prices from CoinGecko.

**Imports:**
- `COINGECKO_BASE`, `EXCHANGE_IDS` from `@/lib/constants`
- `Result`, `ExchangeFee` from `@/lib/types`

**Auth:** `COINGECKO_API_KEY` env var, passed as header `x-cg-demo-api-key`

**Functions:**
```typescript
export async function fetchBtcPrice(): Promise<Result<{
  usd: number;
  change_24h_pct: number;
  change_7d_pct: number;
  market_cap_usd: number;
  volume_24h_usd: number;
}>>

export async function fetchGlobalData(): Promise<Result<{ dominance_pct: number }>>

export async function fetchHistoricalPrices(days: number): Promise<Result<number[]>>

export async function fetchExchanges(): Promise<Result<ExchangeFee[]>>

export async function fetchGoldPrice(): Promise<Result<{ gold_price_usd: number }>>
```

**fetchBtcPrice:** `GET /coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false`
- Extract from `market_data`: `current_price.usd`, `price_change_percentage_24h`, `price_change_percentage_7d`, `market_cap.usd`, `total_volume.usd`

**fetchGlobalData:** `GET /global`
- Extract `data.market_cap_percentage.btc`

**fetchHistoricalPrices:** `GET /coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
- Return array of closing prices from `prices` field (each entry is `[timestamp, price]`)

**fetchExchanges:** `GET /exchanges` (paginated if needed)
- Filter to `EXCHANGE_IDS`, map to `ExchangeFee` — note: CoinGecko exchange endpoint gives `trust_score_rank` and name but NOT maker/taker fees directly. Use `trust_score` field. For fees, set reasonable defaults or fetch from `/exchanges/{id}` individually.

**fetchGoldPrice:** `GET /simple/price?ids=bitcoin&vs_currencies=xau`
- Calculate gold price: `btc_usd_price / btc_xau_price`

---

## File 5: `src/trigger/lib/mempool.ts`

**Purpose:** Fetch Bitcoin network data from Mempool.space API.

**Imports:**
- `MEMPOOL_BASE` from `@/lib/constants`
- `Result` from `@/lib/types`

**Auth:** None (public API)

**Function:**
```typescript
export async function fetchMempoolData(): Promise<Result<{
  hashrate_eh_s: number;
  difficulty: number;
  block_height: number;
  mempool_tx_count: number;
  mempool_size_mb: number;
  fee_fast_sat_vb: number;
  fee_medium_sat_vb: number;
  fee_slow_sat_vb: number;
}>>
```

**Logic — multiple endpoints:**
1. `GET ${MEMPOOL_BASE}/v1/mining/hashrate/1w` → latest hashrate (convert to EH/s)
2. `GET ${MEMPOOL_BASE}/v1/difficulty-adjustment` → `difficulty`
3. `GET ${MEMPOOL_BASE}/blocks/tip/height` → `block_height`
4. `GET ${MEMPOOL_BASE}/mempool` → `count` (tx count), `vsize` (convert bytes to MB)
5. `GET ${MEMPOOL_BASE}/v1/fees/recommended` → `fastestFee`, `halfHourFee`, `economyFee`

Use `Promise.allSettled` for all 5 calls — return partial data if some fail.

---

## File 6: `src/trigger/lib/alternativeme.ts`

**Purpose:** Fetch the Bitcoin Fear & Greed Index.

**Imports:**
- `ALTERNATIVE_ME_FNG` from `@/lib/constants`
- `Result` from `@/lib/types`

**Function:**
```typescript
export async function fetchFearGreedIndex(): Promise<Result<{
  value: number;
  label: string;
}>>
```

**Logic:**
1. `GET ${ALTERNATIVE_ME_FNG}?limit=1`
2. Parse `data[0]` → `value` (number), `value_classification` (string label)

---

## File 7: `src/trigger/lib/technical-indicators.ts`

**Purpose:** Calculate RSI-14, SMA-50, SMA-200 from historical price data using the `trading-signals` npm package.

**Imports:**
- `Result` from `@/lib/types`
- `RSI`, `SMA` from `trading-signals`

**Function:**
```typescript
export function calculateIndicators(closingPrices: number[]): Result<{
  rsi_14: number;
  sma_50: number;
  sma_200: number;
}>
```

**Logic:**
1. Expects an array of daily closing prices (oldest first, at least 200 entries)
2. Create `new RSI(14)`, `new SMA(50)`, `new SMA(200)`
3. Feed each price into all three indicators via `.update(price)`
4. After all prices fed, read `.getResult()` from each → round to 2 decimals
5. If not enough data points, return error

**Note:** This is a pure computation function (no HTTP calls). It receives historical prices from `coingecko.ts`'s `fetchHistoricalPrices(200)`.
