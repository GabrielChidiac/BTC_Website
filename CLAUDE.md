# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Rules
You are my ruthless mentor and my reflection partner. Your role is finding the truth and giving it to me as honestly as possible even if it is to the detriment of my feelings.
- Never agree with me just to be pleasant.
- Find the weaknesses and blind spots in my thinking. Point them out even if I haven't asked.
- No flattery, no unnecessary softening.
- If you're unsure about something, verify it through research and provide sources.
- Remain steadfast. Force me to defend my ideas or abandon the bad ones.
- If I'm searching for validation instead of the truth, point it out.

## Project
AI-curated daily Bitcoin intelligence for high-net-worth individuals and business executives. Runs a Trigger.dev pipeline at 2 AM CET that collects news and market data, processes through Claude Sonnet into a structured briefing, enriches via Perplexity (institutional flows, expert insights, supply dynamics), and publishes to a Next.js site + email subscribers.

**Target audience:** Busy executives, HNW individuals, institutional investors. Not beginners. Write peer-to-peer with sophisticated investors. Let the data speak for itself — no hype, no hand-holding.

## Tech Stack
| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, ISR) | `next@16.2.1`, React 19 |
| Pipeline | Trigger.dev v3 (`@trigger.dev/sdk@^4.4.3`) | Cron tasks, 15min global max (`maxDuration: 900`) |
| Database | Supabase (Postgres + RLS) | `@supabase/ssr@^0.9.0` |
| Styling | Tailwind CSS v4 | CSS-only config via `@theme` |
| AI | Claude Sonnet (briefing) + Perplexity sonar-pro (enrichment) | Kie.ai fallback for Claude |
| Payments | Whop | Free/Pro tiers, $7/month or $59/year |
| Email | Resend + React Email | |
| UI Components | shadcn/ui (base-nova) | `npx shadcn@latest add <component>` |
| Animation | Framer Motion + GSAP | Only animate `transform` and `opacity` |
| Technical Analysis | trading-signals | RSI-14, SMA-50, SMA-200 |
| Language | TypeScript (strict) | No tests or linter configured |

## Dev Commands
```bash
npm run dev                   # Next.js at http://localhost:3000
npm run build                 # Production build (verifies all types)
npm start                     # Start production server
npx trigger.dev@latest dev    # Trigger.dev local runner
```

CI/CD: `.github/workflows/trigger-deploy.yml` deploys Trigger.dev tasks on push to main.

Path alias: `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Documentation
- [docs/plan.md](docs/plan.md) — Implementation plan
- [docs/architecture.md](docs/architecture.md) — Full file tree, data flow
- [docs/decisions.md](docs/decisions.md) — Key technical decisions
- [docs/orchestrator.md](docs/orchestrator.md) — Pipeline orchestrator reference
- [docs/deployment.md](docs/deployment.md) — Deployment guide
- [docs/design-brief.md](docs/design-brief.md) — Design brief (color system, typography lockups)

## Working Rules
- **Always verify before writing.** Read the relevant schema, types, and existing code before writing any new code. Never assume a field, type, or pattern exists — confirm it first.

## Critical Patterns

### Result Type
All API wrappers return `Result<T>`. Never throw from wrappers.
```typescript
type Result<T> = { data: T; error: null } | { data: null; error: string };
```

### Trigger.dev
- Use `batch.triggerAndWait()` for parallel sub-tasks
- **Never** `Promise.all` with individual `triggerAndWait` calls
- `Promise.allSettled` is fine inside wrapper functions
- Cron: `"0 1 * * *"` (1 UTC = 2 CET)
- Max duration: 15 min global (`maxDuration: 900` in `trigger.config.ts`)
- Task files go in `src/trigger/` (configured via `dirs` in `trigger.config.ts`)

### Supabase
- `@supabase/ssr` only — never import `@supabase/supabase-js` directly
- `createServerClient()` in `src/lib/supabase/server.ts` — for Server Components (respects RLS)
- `createServiceClient()` in `src/lib/supabase/server.ts` — for Trigger tasks + API route handlers (bypasses RLS via `SUPABASE_SERVICE_ROLE_KEY`)
- `createClient()` in `src/lib/supabase/client.ts` — for client components
- **Always use `.maybeSingle()`** for single-row queries — never `.single()` (which throws on 0 results). All queries in the codebase follow this pattern.

### Tailwind v4
- Config lives in `src/app/globals.css` via `@import "tailwindcss"` + `@theme inline`
- **No `tailwind.config.js`** — Tailwind v4 doesn't use one
- Custom CSS variables defined in `@theme`: `--color-bg-base`, `--color-accent`, `--font-heading`, etc.

### Authentication
- **Magic link auth** — no passwords. Email subscribers get magic link tokens (10-min expiry, not consumed on use)
- `verify-send` sends magic link → `verify-check` validates token, checks subscriber is active, creates 30-day session
- Session cookie (`btc-session`): httpOnly, secure in production, sameSite lax, 30-day maxAge
- Session tokens stored as `session:<uuid>` in `verification_codes.code`; cookie stores `{ email, token }` JSON where `token` is the UUID portion
- **Max 3 concurrent sessions** per email — oldest evicted on 4th login
- PDF route (`/pdf/[date]`) accepts both session cookie and magic link token via query params
- All email links (briefing, PDF, chat) share the same per-subscriber magic token
- `getBaseUrl()` (`src/lib/url.ts`) resolves site URL — never falls back to localhost

### Subscription Tiers
- **Free tier:** Market overview, top stories, BTC vs everything, macro context, weekly recap email — **available for 7 days only**
- **Pro tier:** All free features + regulatory/adoption signals, daily briefing email, ETF flows, institutional activity, technical signals, network health, expert insights, supply dynamics, forward outlook, countdown events, AI chat, PDF downloads, full archive (all dates)
- Tiers stored in `subscribers.tier` column (`'free'` | `'pro'`)
- Whop handles payments via webhook at `/api/webhooks/whop`
- `verifyWhopWebhook()` in `src/lib/whop.ts` validates webhook signatures via HMAC-SHA256
- Webhook handles `membership.went_valid` (→ pro) and `membership.went_invalid` (→ free)
- If a paying user isn't already a subscriber, the webhook auto-creates them as active/pro
- `getSubscriberTier()` in `src/lib/tier.ts` reads session cookie → checks tier
- All existing active subscribers were gifted Pro tier at launch
- Subscriber status: `'active'` | `'inactive'` | `'pending'` (stored in `subscribers.status`)

**Founding members:**
- `is_founding_member` boolean on `subscribers` table
- `FOUNDING_MEMBER_LIMIT` constant in `src/lib/constants.ts`
- `getFoundingMemberStatus()` in `src/lib/founding.ts` checks spots remaining
- Founding members get `founding-welcome.tsx` email; other Pro subscribers get `pro-welcome.tsx`

**Tier gating rules:**
- **Homepage:** Free users see sections 01–04 (hero, market, what happened, top stories). Sections 05–07 (adoption & regulatory, deep dive, looking ahead) are behind `ProTeaser` blur.
- **Archive list:** Free users see only last 7 days. Pro users see all dates.
- **Archive [date]:** Free users on recent briefings (≤7 days) see free-tier sections only; pro-only sections show `ProGateCompact`. Old briefings (>7 days) show only DailyDiff + MarketSnapshot for free users.
- **Chat:** Pro only — free users redirected to `/pricing` at page level.
- **PDF:** Pro only — auth checked in route handler.

### Claude API Integration
- `callClaudeJSON<T>()` in `src/trigger/lib/anthropic.ts` auto-retries once with a "fix your JSON" prompt on parse failure
- Fallback chain: Anthropic SDK (Claude Sonnet) → Kie.ai (OpenAI-compatible endpoint) on 429/5xx errors
- All wrappers return `Result<T>` — never throw

### Native fetch
- All HTTP calls use native `fetch` — no axios

## Environment Variables
All keys are listed in `.env.example` with descriptions. Key services: Anthropic, Perplexity, Kie.ai (Claude fallback), CoinGecko, SearchAPI, Jina Reader, Trigger.dev, Resend, Supabase, Whop.

## Database (Supabase)
5 tables -- migrations in `supabase/migrations/`: `daily_briefings` (date PK + JSONB content), `subscribers`, `verification_codes`, `chat_rate_limits`, `chat_conversations`.

RLS: briefings are publicly readable; all other tables are service-role only.

## API Routes
Routes live in `src/app/api/`. Key endpoints: subscribe, unsubscribe, revalidate (ISR), chat (Claude, rate-limited 20/10min), chat/history (conversation retrieval), chat/verify-send + verify-check (magic link auth), logout, webhooks/whop, and `/pdf/[date]` (GET, Pro only). Chat supports conversation threading via `chat_conversations` table.

## Pipeline Architecture
```
2 AM CET daily (Trigger.dev cron):

  ┌─ news collector ──────┐
  │  (RSS feeds +          │
  │   SearchAPI)           │──→ AI Brain (Claude) ──→ Enrichment (Perplexity x4)
  └─ market collector ─────┘         │                       │
     (CoinGecko, Mempool,           │                       ├── looking_ahead
      Yahoo Finance,                v                       ├── institutional_flows
      Alternative.me,          BriefingJSON ◄───────────────├── expert_insights
      SoSoValue ETF)                │                       └── supply_dynamics
                                    ├──→ Save to Supabase
                                    ├──→ Revalidate Next.js (ISR)
                                    └──→ Send email digest (Resend)
```
- Collectors run **parallel** via `batch.triggerAndWait`
- AI Brain → Enrichment → Save → Revalidate → Email run **sequential**
- `src/trigger/lib/fetch-timeout.ts` provides `fetchWithTimeout()` and `withTimeout()` helpers for API calls

**Fault tolerance:**
- Collectors: **non-fatal** — failed sources default to empty/null, pipeline continues
- AI Brain: **FATAL** — if Claude fails, entire pipeline stops (no briefing published)
- Enrichment: **non-fatal** — Perplexity failures default to fallback text; runs 4 queries in parallel (forward outlook, institutional activity, expert insights, supply dynamics)
- Publishers: **sequential** — if save fails, email is never sent

**BriefingJSON composition:**
- AI Brain generates the base `BriefingJSON` structure (stories, market, technical, narrative, macro, etc.)
- Enrichment *overwrites* 4 fields: `looking_ahead`, `institutional_flows`, `expert_insights`, `supply_dynamics`
- `fear_greed` comes from market collector directly (not AI Brain or enrichment)
- `etf_flows` comes from SoSoValue API via market collector (not enrichment) — daily net flow, MTD, total AUM
- `institutional_flows` from Perplexity focuses on non-ETF activity: corporate treasury, whale movements, fund allocations, OTC desk, mining companies

**News pipeline:** Articles deduped by normalized URL (lowercase, trimmed), filtered by BTC-relevance keyword regex, top 10 scraped for full text via Jina Reader (non-fatal per article)

**Email & PDF:**
- Digest emails batched in chunks of 100 (Resend limit)
- PDF generated via `@react-pdf/renderer`, uploaded to Supabase Storage bucket `briefing-pdfs`
- `send-weekly-recap` runs Sunday 9 AM UTC, sent to free-tier subscribers only
- Weekly recap date range: yesterday (Saturday) back 6 days (previous Sunday) — avoids including Sunday with no briefing
- All emails (daily-digest, weekly-recap, welcome) include unsubscribe links in footers
- Daily-digest and weekly-recap use `%%UNSUBSCRIBE_URL%%` placeholder, replaced per-subscriber with a magic-token sign-in URL
- Welcome email links directly to `/sign-in` (no magic token available at subscribe time)
- Contact/support email: `hello@btctoday.co` (used in email FROM, website footer, pricing FAQ)
- Email templates live in `emails/` directory: `welcome.tsx`, `pro-welcome.tsx`, `founding-welcome.tsx`, `verification.tsx`, `daily-digest.tsx`, `weekly-recap.tsx`, `daily-summary-pdf.tsx`, `unsubscribe-confirmation.tsx`

## Frontend Rules

### Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code. No exceptions.

### Design System
- Light/cool gray theme: bg `#E2E5EE`, surfaces translucent `rgba(240,240,246,0.65)`, accent `#F7931A` (BTC orange) + `#3B82F6` (atmospheric blue, background only)
- Space Grotesk (headings, tracking `-0.04em`, line-height `1.1`) + Inter (body, weight `300`, line-height `1.8`)
- Bloomberg terminal / editorial aesthetic
- Mobile-first, `max-w-3xl`, information-dense
- Font variables: `--font-space-grotesk`, `--font-inter`, `--font-sans` (Geist) (set in `layout.tsx`)

### Brand Assets
- Check `public/` for any static assets before designing. Use real assets over placeholders.

### Anti-Generic Guardrails
- **Colors:** Never default Tailwind palette. Derive from brand `#F7931A` (orange) + `#3B82F6` (blue atmosphere).
- **Shadows:** Layered, color-tinted, low opacity. Never flat `shadow-md`.
- **Typography:** Different fonts for headings vs body. Always.
- **Gradients:** Layer multiple radial gradients. Add SVG noise for texture.
- **Animations:** Only `transform` and `opacity`. Never `transition-all`. Spring easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, active.
- **Images:** Gradient overlay (`from-black/60`) + `mix-blend-multiply` color layer.
- **Spacing:** Consistent tokens. No random Tailwind steps.
- **Depth:** Layering system (base → elevated → floating).

### Reference Images
- If provided: match exactly. Do not improve or add to the design.
- If not provided: design from scratch with high craft per guardrails above.

### Hard Rules
- Do not add sections/features not in the reference
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

## Content Philosophy
- **Quality over quantity** — fewer sections, each must be top-notch
- **No basic education** — no "What is mining?" or "Explain Like I'm New"
- **Institutional lens** — frame everything through where money flows, macro implications, long-term value
- **Anti-skeptic by data** — let BTC vs Everything comparisons (24h, YTD, 1Y) speak for themselves
- **Expert voices** — Perplexity-sourced insights from recognized analysts (Lyn Alden, Saylor, etc.), not YouTube influencers
- **Chat starter prompts** must be institutional-grade (macro catalysts, ETF data, expert commentary) — never beginner questions

## Pages
| Route | Purpose |
|---|---|
| `/` | Homepage — latest briefing |
| `/archive` | Briefing archive list |
| `/archive/[date]` | Single archived briefing |
| `/chat` | AI chat interface (requires auth, Pro only) |
| `/sign-in` | Magic link sign-in page |
| `/pricing` | Free vs Pro comparison, Whop checkout links |
| `/pdf/[date]` | PDF download (auth required, Pro only) |

## Deployment Notes
See `docs/deployment.md` for the full deployment guide. Remaining production TODOs:
- Set all env vars in Vercel (see `.env.example`)
- Set Whop env vars (`WHOP_WEBHOOK_KEY`, `NEXT_PUBLIC_WHOP_MONTHLY_URL`, `NEXT_PUBLIC_WHOP_ANNUAL_URL`)
- Configure webhook URL in Whop dashboard → `https://btctoday.co/api/webhooks/whop`
