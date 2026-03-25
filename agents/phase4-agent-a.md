# Phase 4 — Agent A: AI Brain Processor Task

## Mission
Create `src/trigger/processors/ai-brain.ts` — a Trigger.dev task that takes all collector outputs, fetches yesterday's briefing from Supabase, and sends a single Claude call to produce a structured `BriefingJSON` (minus `looking_ahead`).

## Shared Rules
- Import `task`, `logger` from `@trigger.dev/sdk/v3`
- Use `Result<T>` pattern (import from `@/lib/types`)
- Use `callClaudeJSON<T>` from `@/trigger/lib/anthropic` for the Claude call
- Use `createServiceClient` from `@/lib/supabase/server` for Supabase reads
- Never throw — return graceful defaults on failure

---

## File: `src/trigger/processors/ai-brain.ts`

**Purpose:** Process all raw collector data into a structured BriefingJSON via a single Claude Sonnet call.

**Imports:**
- `task`, `logger` from `@trigger.dev/sdk/v3`
- `callClaudeJSON` from `@/trigger/lib/anthropic`
- `createServiceClient` from `@/lib/supabase/server`
- `halvingProgress` from `@/lib/utils`
- Types: `BriefingJSON`, `NewsCollectorOutput`, `YoutubeCollectorOutput`, `MarketCollectorOutput`, `DailyBriefingRow` from `@/lib/types`

**Task ID:** `"ai-brain"`

**Payload:**
```typescript
{
  date: string;                       // "YYYY-MM-DD"
  news: NewsCollectorOutput;          // { articles: RawArticle[] }
  youtube: YoutubeCollectorOutput;    // { transcripts: TranscriptResult[] }
  market: MarketCollectorOutput;      // price, network, exchanges, comparisons, etc.
}
```

**Return type:** `Omit<BriefingJSON, "looking_ahead">`

**Logic:**

### Step 1: Fetch yesterday's briefing from Supabase
1. Use `createServiceClient()` to get a Supabase client
2. Calculate yesterday's date from `payload.date`
3. Query `daily_briefings` table: `.select("content").eq("date", yesterdayDate).maybeSingle()`
4. If found, extract `narrative_consensus.score` and `market_snapshot.price_usd` for the daily_diff comparison
5. If not found (first run or gap), set yesterday data to null — Claude will handle it gracefully

### Step 2: Compute halving progress
1. Call `halvingProgress(payload.market.network.block_height)` to get `progressPct` and `blocksRemaining`

### Step 3: Build the Claude prompt
1. **System prompt** — instruct Claude to act as a Bitcoin intelligence analyst that produces a daily briefing. Key instructions:
   - Output must be valid JSON matching the `BriefingJSON` schema (minus `looking_ahead`)
   - Be factual, concise, and analytical
   - Sentiment must be derived from actual data, not assumed
   - `narrative_consensus.score` ranges from -100 (extreme bear) to +100 (extreme bull)
   - `daily_diff` should compare against yesterday's data if provided
   - `countdown_events` should include known upcoming Bitcoin events (halving, protocol upgrades, ETF deadlines, etc.)
   - `technical_signals.support_level` and `resistance_level` should be estimated from price action and SMA levels
   - `technical_signals.signal_summary` should be a human-readable 1-sentence summary
   - Each `top_stories` entry needs both a `summary` (detailed) and `elin_summary` (explain-like-I'm-new, simplified)
   - `community_voices` should summarize YouTube transcripts with channel attribution
   - Return ONLY valid JSON — no markdown fences, no extra text

2. **User prompt** — include all raw data in a structured format:
   - Date
   - News articles (title, source, url, description) — all of them
   - YouTube transcripts (channel, title, transcript text) — all of them
   - Market data: price, changes, market cap, volume, dominance, fear & greed
   - Technical indicators: RSI-14, SMA-50, SMA-200
   - Network data: hashrate, difficulty, block height, mempool, fees
   - Halving progress: percentage and blocks remaining
   - Exchange fees data
   - Comparison data: S&P 500, gold, DXY
   - Yesterday's briefing summary (if available): previous price, previous narrative score

### Step 4: Call Claude
1. Use `callClaudeJSON<Omit<BriefingJSON, "looking_ahead">>` with `maxTokens: 8192`
2. If the call returns an error, log it and return a **fallback briefing** with:
   - Empty `top_stories`, `community_voices`, `countdown_events`
   - Market data populated from raw collector data (so the briefing still has numbers)
   - `narrative_consensus` set to `{ score: 0, label: "Neutral", rationale: "AI analysis unavailable" }`
   - `daily_diff` set to a basic price change string from raw data

### Step 5: Return the briefing
1. Ensure the `date` field matches `payload.date`
2. Return the parsed BriefingJSON (minus `looking_ahead`)

---

## Fallback Briefing Builder

Create a helper function `buildFallbackBriefing` that constructs a minimal valid `Omit<BriefingJSON, "looking_ahead">` from raw market data. This ensures the pipeline can still publish even if Claude is completely down. The fallback should populate:
- `market_snapshot` from `MarketCollectorOutput`
- `network_health` from `MarketCollectorOutput.network` + halving data
- `technical_signals` from `MarketCollectorOutput.technical` (support/resistance = 0, signal_summary = "Data available but AI analysis failed")
- `btc_vs_everything` from `MarketCollectorOutput.comparisons`
- `fee_comparison` from `MarketCollectorOutput.exchanges`
- Everything else gets sensible empty/zero defaults

---

## Key Constraints
- The Claude prompt must be explicit about the JSON schema — list every field Claude must produce
- `maxTokens: 8192` — the response is large (full briefing)
- The system prompt should include the TypeScript interface definitions so Claude knows the exact shape
- Use `callClaudeJSON` which handles the JSON parse retry automatically
- Never throw from this task — always return a valid briefing shape
