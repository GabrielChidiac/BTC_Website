# Phase 3 — Agent B: YouTube Collector Task

## Mission
Create 1 Trigger.dev v3 task file in `src/trigger/collectors/`. This task discovers recent YouTube videos via RSS and fetches their transcripts.

## Shared Rules
- Use `task` from `@trigger.dev/sdk/v3`
- Use `@/` import alias for all project imports
- Check `Result<T>` pattern: if `.error` is `null`, use `.data`; otherwise log and skip
- Never throw from the task — always return a valid output (empty array if everything fails)
- Use `Promise.allSettled` for parallel transcript fetches

```typescript
import { task } from "@trigger.dev/sdk/v3";
```

---

## File: `src/trigger/collectors/youtube.ts`

**Purpose:** Discover recent YouTube videos from 5 Bitcoin channels via RSS, fetch transcripts for videos published in the last 24 hours.

**Task ID:** `youtube-collector`

**Input:** `{ date: string }` — ISO date like `"2025-05-15"`

**Output:** `YoutubeCollectorOutput { transcripts: TranscriptResult[] }`

**Imports:**
- `task` from `@trigger.dev/sdk/v3`
- `YoutubeCollectorOutput`, `TranscriptResult` from `@/lib/types`
- `isWithinHours` from `@/lib/utils`
- `fetchYoutubeRss` from `@/trigger/lib/rss`
- `fetchTranscript` from `@/trigger/lib/youtube-transcript`

**Logic:**
1. Call `fetchYoutubeRss()` → `Promise<Result<{ channelName: string; videoId: string; title: string; publishedAt: string }[]>>`
   - If error → log and return `{ transcripts: [] }`
2. Filter returned videos to those published within last 24h using `isWithinHours(video.publishedAt, 24)`
   - If no recent videos → return `{ transcripts: [] }`
3. For each recent video, call `fetchTranscript(video)` in parallel via `Promise.allSettled`
   - `fetchTranscript` takes `{ channelName, videoId, title, publishedAt }` — exact same shape as RSS output
   - Wrapper already handles: 30s timeout, fallback to title if transcript fails, truncation to 3000 words
   - Returns `Result<TranscriptResult>`
4. For each settled result:
   - If `status === "fulfilled"` and `.value.error === null` → collect `.value.data`
   - Otherwise → log warning
5. Sort collected transcripts by `published_at` descending (newest first)
6. Log summary: total videos found → recent videos → transcripts collected
7. Return `{ transcripts: [...] }`
