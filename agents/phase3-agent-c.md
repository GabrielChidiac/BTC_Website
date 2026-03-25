# Phase 3 — Agent C: Market Collector Task

## Mission
Create 1 Trigger.dev v3 task file in `src/trigger/collectors/`. This task collects all market, network, and comparison data, then computes technical indicators.

## Shared Rules
- Use `task` from `@trigger.dev/sdk/v3`
- Use `@/` import alias for all project imports
- Check `Result<T>` pattern: if `.error` is `null`, use `.data`; otherwise log and use defaults
- Never throw from the task — always return data even if partial (use sensible defaults)
- Use `Promise.allSettled` for parallel wrapper calls

```typescript
import { task, logger } from "@trigger.dev/sdk/v3";
```

---

## File: `src/trigger/collectors/market.ts`

**Purpose:** Collect Bitcoin price, market cap, network health, Fear & Greed, exchange fees, asset comparisons, and compute technical indicators (RSI-14, SMA-50, SMA-200).

**Task ID:** `market-collector`

**Input:** `{ date: string }` — ISO date like `"2025-05-15"`

**Output:** `MarketCollectorOutput` (defined in `@/lib/types`, lines 139–173)

**Imports:**
- `task`, `logger` from `@trigger.dev/sdk/v3`
- `MarketCollectorOutput`, `ExchangeFee` from `@/lib/types`
- `fetchBtcPrice`, `fetchGlobalData`, `fetchHistoricalPrices`, `fetchExchanges`, `fetchGoldPrice` from `@/trigger/lib/coingecko`
- `fetchMempoolData` from `@/trigger/lib/mempool`
- `fetchFearGreedIndex` from `@/trigger/lib/alternativeme`
- `calculateIndicators` from `@/trigger/lib/technical-indicators`
- `fetchSP500`, `fetchDXY` from `@/trigger/lib/comparison`

**Logic:**

### Step 1 — Parallel data fetching
Fire all 9 async API calls via `Promise.allSettled`:
```
fetchBtcPrice()           → { usd, change_24h_pct, change_7d_pct, market_cap_usd, volume_24h_usd }
fetchGlobalData()         → { dominance_pct }
fetchHistoricalPrices(200)→ number[] (200 daily closing prices)
fetchExchanges()          → ExchangeFee[]
fetchGoldPrice()          → { gold_price_usd }
fetchMempoolData()        → { hashrate_eh_s, difficulty, block_height, mempool_tx_count, mempool_size_mb, fee_fast/medium/slow_sat_vb }
fetchFearGreedIndex()     → { value, label }
fetchSP500()              → { change_24h_pct }
fetchDXY()                → { change_24h_pct }
```

### Step 2 — Unwrap results
For each settled promise, check:
- `status === "fulfilled"` → check `Result<T>` `.error` field
- Use data if available, log errors and fall back to defaults otherwise

**Defaults:**
- Numbers: `0`
- Nullable comparison fields: `null`
- Fear & Greed label: `"Unknown"`
- Exchanges: `[]`

### Step 3 — Compute technical indicators
- **Only if** `fetchHistoricalPrices` returned 200+ data points
- Call `calculateIndicators(closingPrices)` — this is **synchronous**, returns `Result<{ rsi_14, sma_50, sma_200 }>`
- Default to `{ rsi_14: 0, sma_50: 0, sma_200: 0 }` on failure

### Step 4 — Assemble output
Map all collected data into `MarketCollectorOutput`:
```typescript
{
  price: {
    usd: btcPrice?.usd ?? 0,
    change_24h_pct: btcPrice?.change_24h_pct ?? 0,
    change_7d_pct: btcPrice?.change_7d_pct ?? 0,
    market_cap_usd: btcPrice?.market_cap_usd ?? 0,
    volume_24h_usd: btcPrice?.volume_24h_usd ?? 0,
  },
  dominance_pct: globalData?.dominance_pct ?? 0,
  fear_greed: {
    value: fearGreed?.value ?? 0,
    label: fearGreed?.label ?? "Unknown",
  },
  technical,
  network: {
    hashrate_eh_s: mempool?.hashrate_eh_s ?? 0,
    difficulty: mempool?.difficulty ?? 0,
    block_height: mempool?.block_height ?? 0,
    mempool_tx_count: mempool?.mempool_tx_count ?? 0,
    mempool_size_mb: mempool?.mempool_size_mb ?? 0,
    fee_fast_sat_vb: mempool?.fee_fast_sat_vb ?? 0,
    fee_medium_sat_vb: mempool?.fee_medium_sat_vb ?? 0,
    fee_slow_sat_vb: mempool?.fee_slow_sat_vb ?? 0,
  },
  exchanges: exchanges ?? [],
  comparisons: {
    sp500_change_24h_pct: sp500?.change_24h_pct ?? null,
    gold_price_usd: gold?.gold_price_usd ?? null,
    dxy_change_24h_pct: dxy?.change_24h_pct ?? null,
  },
}
```

**Important:** Do NOT call `halvingProgress()` here — `MarketCollectorOutput.network` does not include halving fields. Those are assembled later by the AI brain task into `NetworkHealth`.

### Step 5 — Log summary and return
Log which data sources were available vs failed, then return the assembled output.
