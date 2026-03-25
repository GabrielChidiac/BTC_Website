# Phase 3 — Agent A: News Collector Task

## Mission
Create 1 Trigger.dev v3 task file in `src/trigger/collectors/`. This task orchestrates the Phase 2 data source wrappers to collect and deduplicate news articles.

## Shared Rules
- Use `task` from `@trigger.dev/sdk/v3`
- Use `@/` import alias for all project imports
- Check `Result<T>` pattern: if `.error` is `null`, use `.data`; otherwise log and skip
- Never throw from the task — always return a valid output (empty array if everything fails)
- Use `Promise.allSettled` for parallel wrapper calls (NOT `batch.triggerAndWait` — these are function calls, not tasks)

```typescript
import { task } from "@trigger.dev/sdk/v3";
```

---

## File: `src/trigger/collectors/news.ts`

**Purpose:** Collect recent Bitcoin news articles from SearchAPI (Google News) and RSS feeds, merge, deduplicate, and filter to last 24 hours.

**Task ID:** `news-collector`

**Input:** `{ date: string }` — ISO date like `"2025-05-15"`

**Output:** `NewsCollectorOutput { articles: RawArticle[] }`

**Imports:**
- `task` from `@trigger.dev/sdk/v3`
- `NewsCollectorOutput`, `RawArticle` from `@/lib/types`
- `isWithinHours` from `@/lib/utils`
- `fetchSearchApiNews` from `@/trigger/lib/searchapi`
- `fetchRssArticles` from `@/trigger/lib/rss`

**Logic:**
1. Call `fetchSearchApiNews()` and `fetchRssArticles()` in parallel via `Promise.allSettled`
   - `fetchSearchApiNews()` → `Promise<Result<RawArticle[]>>` — already runs 2 Google News queries internally and deduplicates
   - `fetchRssArticles()` → `Promise<Result<RawArticle[]>>` — fetches from 5 RSS feeds
2. For each settled result:
   - If `status === "fulfilled"` and `.value.error === null` → push `.value.data` articles into merged array
   - Otherwise → log warning with `[news-collector]` prefix
3. Deduplicate merged array by normalized URL (lowercase, strip trailing slash) using a `Set`
4. Filter to articles published within last 24h using `isWithinHours(article.published_at, 24)`
5. Sort by `published_at` descending (newest first)
6. Log summary: raw count → deduplicated count → final count
7. Return `{ articles: [...] }`

**Helper function:**
```typescript
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}
```
