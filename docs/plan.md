# BTC Today — Implementation Plan

## Context

Building "BTC Today" — an AI-curated daily Bitcoin intelligence website. A Next.js app with a Trigger.dev pipeline that runs daily at 6 AM CET, collects news/market/YouTube data, processes it through Claude Sonnet, and publishes a structured briefing to the website + email subscribers.

---

## Phases

### Phase 0: Scaffolding (direct)
1. `npx create-next-app@latest . --typescript --app --tailwind --src-dir --import-alias "@/*" --no-eslint`
2. Install deps:
   ```bash
   npm add @trigger.dev/sdk @supabase/ssr @anthropic-ai/sdk resend @react-email/components rss-parser youtube-transcript trading-signals yahoo-finance2
   npm add -D @trigger.dev/build @types/node
   ```
3. Create `trigger.config.ts`, `.env.example`
4. Set up `globals.css` with Tailwind v4 `@import "tailwindcss"` + `@theme`
5. Update `layout.tsx` with Space Grotesk + IBM Plex Sans, dark theme

### Phase 1: Types + Database + Supabase Clients (1 agent)
- `src/lib/types.ts` — Full `BriefingJSON` interface
- `src/lib/constants.ts` — RSS URLs, YT channel IDs, API endpoints, exchange IDs
- `src/lib/utils.ts` — Date formatting, halving progress calculator
- `supabase/migrations/001_initial_schema.sql` — Tables + RLS
- `src/lib/supabase/server.ts` — `createServerClient`
- `src/lib/supabase/client.ts` — `createBrowserClient`

### Phase 2: Pipeline API Wrappers (2 agents parallel)

**Agent A — Data source wrappers (7 files):**

| File | What |
|---|---|
| `searchapi.ts` | SearchAPI.io Google News |
| `rss.ts` | RSS feeds + YouTube RSS |
| `youtube-transcript.ts` | YT RSS → video IDs → transcript (30s timeout, fallback to title+desc) |
| `coingecko.ts` | Price, historical 200d, exchanges. `x-cg-demo-api-key` header |
| `mempool.ts` | Hashrate, difficulty, fees, mempool, block height |
| `alternativeme.ts` | Fear & Greed index |
| `technical-indicators.ts` | RSI-14, SMA-50, SMA-200 via `trading-signals` |

**Agent B — AI + comparison wrappers (3 files):**

| File | What |
|---|---|
| `anthropic.ts` | Claude Sonnet + Kie.ai fallback |
| `perplexity.ts` | `sonar-pro` model |
| `comparison.ts` | S&P via `yahoo-finance2`, DXY via Alpha Vantage |

Every wrapper returns: `type Result<T> = { data: T; error: null } | { data: null; error: string }`

### Phase 3: Collector Tasks (3 agents parallel)

**news.ts:** SearchAPI (2 queries) + RSS (5 feeds) → merge, dedup, filter 24h

**youtube.ts:** 5 channels RSS → filter 24h → fetch transcripts (fallback: title+desc) → truncate 3000 words

**market.ts:** `Promise.allSettled` on CoinGecko (price + global + historical + exchanges) + Mempool + F&G + Yahoo S&P + Alpha Vantage DXY → compute RSI/SMA/halving progress/relative performance

### Phase 4: Processor Tasks (2 agents parallel)

**ai-brain.ts:** Fetch yesterday's briefing → single Claude call with all collector data → structured BriefingJSON (minus looking_ahead). Retry once on JSON parse failure.

**enrichment.ts:** Top 3 headlines → Perplexity sonar-pro → `looking_ahead`. Non-fatal on failure.

### Phase 5: Publisher Tasks (1 agent)
- `save-briefing.ts` — Upsert to `daily_briefings` on date conflict
- `revalidate-site.ts` — POST `/api/revalidate` with Bearer token
- `send-digest.ts` — Fetch subscribers, batch send via Resend + React Email

### Phase 6: Orchestrator (direct)
- `src/trigger/daily-pipeline.ts`
- Cron `"0 5 * * *"` (5 UTC = 6 CET)
- Collectors via `batch.triggerAndWait` (parallel)
- AI brain → enrichment → save → revalidate → email (sequential)
- See [orchestrator.md](orchestrator.md) for full code

### Phase 7: API Routes (1 agent)
- `src/app/api/revalidate/route.ts` — Bearer auth + `revalidatePath`
- `src/app/api/subscribe/route.ts` — Validate email, upsert, welcome email

### Phase 8: Frontend — Homepage (1 agent, invokes frontend-design)
- Dark mode, BTC orange `#F7931A`, bg `#0A0A0A`, surfaces `#141414`/`#1E1E1E`
- Space Grotesk headings, IBM Plex Sans body
- NarrativeConsensus gauge = visual centerpiece
- Bloomberg terminal / editorial aesthetic
- Mobile-first, max-w-3xl, information-dense

### Phase 9: Archive Pages (1 agent)
Archive list + `[date]` detail page, reusing briefing components

### Phase 10: Email Template (1 agent)
`emails/daily-digest.tsx` — market snapshot + top 3 stories + link to full briefing

### Phase 11: Final Checks (direct)
- `npm run build` — verify all imports compile
- Deployment notes for Vercel + Trigger.dev

---

## Verification Checkpoints

1. **Phase 0**: `npm run dev` → blank Next.js app at localhost:3000
2. **Phase 1**: SQL migration runs. Tables + RLS verified in Supabase dashboard
3. **Phase 2**: Each wrapper called in isolation, output logged
4. **Phase 6**: `npx trigger.dev@latest dev` → manual trigger → all collectors return data → briefing saved
5. **Phase 8**: Homepage renders all sections from Supabase. ELIN toggle + subscribe form work
6. **Phase 10**: Manual `sendDigestTask` trigger → email received
7. **Full cycle**: Pipeline → site updates → email sent → all sections populated
