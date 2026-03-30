# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| Email | Resend + React Email | |
| UI Components | shadcn/ui (base-nova) | `npx shadcn@latest add <component>` |
| Animation | Framer Motion + GSAP | Only animate `transform` and `opacity` |
| Technical Analysis | trading-signals | RSI-14, SMA-50, SMA-200 |
| Language | TypeScript (strict) | No tests or linter configured |

## Dev Commands
```bash
npm run dev                   # Next.js at http://localhost:3000
npm run build                 # Production build (verifies all types)
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
- `createServerClient` for server components, route handlers, and Trigger.dev tasks
- `createBrowserClient` for client components
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) for pipeline writes

### Tailwind v4
- Config lives in `src/app/globals.css` via `@import "tailwindcss"` + `@theme inline`
- **No `tailwind.config.js`** — Tailwind v4 doesn't use one
- Custom CSS variables defined in `@theme`: `--color-bg-base`, `--color-accent`, `--font-heading`, etc.

### Authentication
- **Magic link auth** — no passwords. Email subscribers get magic link tokens (10-min expiry, not consumed on use)
- `verify-send` sends magic link → `verify-check` validates token, checks subscriber is active, creates 30-day session
- Session cookie (`btc-session`): httpOnly, secure in production, sameSite lax
- **Max 3 concurrent sessions** per email — oldest evicted on 4th login
- PDF route (`/pdf/[date]`) accepts both session cookie and magic link token via query params
- All email links (briefing, PDF, chat) share the same per-subscriber magic token
- `getBaseUrl()` (`src/lib/url.ts`) resolves site URL — never falls back to localhost

### Native fetch
- All HTTP calls use native `fetch` — no axios

## Environment Variables
All listed in `.env.example`. Required keys:
| Key | Service |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Sonnet (briefing generation) |
| `PERPLEXITY_API_KEY` | sonar-pro (enrichment: forward outlook, institutional flows, expert insights, supply dynamics) |
| `KIE_API_KEY` | Kie.ai (Claude fallback, OpenAI-compatible) |
| `COINGECKO_API_KEY` | CoinGecko Demo (free, `x-cg-demo-api-key` header) |
| `SEARCHAPI_KEY` | SearchAPI.io (Google News scraping for news collector) |
| `JINA_API_KEY` | Jina Reader (full article content extraction, 200 RPM free) |
| `TRIGGER_SECRET_KEY` | Trigger.dev |
| `RESEND_API_KEY` | Resend (email) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side writes) |
| `REVALIDATION_SECRET` | Protects `/api/revalidate` endpoint |
| `NEXT_PUBLIC_SITE_URL` | Site URL (fallback: `https://www.btctoday.co` via `getBaseUrl()` in `src/lib/url.ts`) |

## Database (Supabase)
3 tables, migrations in `supabase/migrations/`:
| Table | Purpose |
|---|---|
| `daily_briefings` | `date` PK + `content` JSONB (the full `BriefingJSON`) |
| `subscribers` | Email list (`email`, `name`, `status`: active/unsubscribed) |
| `verification_codes` | Magic link tokens, session tokens (`email`, `code`, `expires_at`, `used`) |

RLS: briefings are publicly readable; subscribers and verification codes are service-role only.

## API Routes
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/subscribe` | POST | Add email subscriber |
| `/api/revalidate` | POST | ISR revalidation (requires `REVALIDATION_SECRET`) |
| `/api/chat` | POST | Claude chat — requires session token, sends last 7 days of briefings as context |
| `/api/chat/verify-send` | POST | Send magic link to subscriber email |
| `/api/chat/verify-check` | POST | Verify magic link token, create 30-day session (max 3 concurrent devices) |
| `/api/logout` | POST | Clear session cookie |
| `/pdf/[date]` | GET | PDF download — auth via session cookie or magic link token, Pro only |

## Pipeline Architecture
```
2 AM CET daily (Trigger.dev cron):

  ┌─ news collector ──────┐
  │  (11 RSS feeds +       │
  │   SearchAPI)           │──→ AI Brain (Claude) ──→ Enrichment (Perplexity x4)
  └─ market collector ─────┘         │                       │
     (CoinGecko, Mempool,           │                       ├── looking_ahead
      Yahoo Finance,                v                       ├── institutional_flows
      Alternative.me)          BriefingJSON ◄───────────────├── expert_insights
                                    │                       └── supply_dynamics
                                    ├──→ Save to Supabase
                                    ├──→ Revalidate Next.js (ISR)
                                    └──→ Send email digest (Resend)
```
- Collectors run **parallel** via `batch.triggerAndWait`
- AI Brain → Enrichment → Save → Revalidate → Email run **sequential**
- Enrichment is **non-fatal** — briefing publishes even if Perplexity fails
- Enrichment runs 4 Perplexity queries in parallel: forward outlook, institutional flows, expert insights, supply dynamics

## Frontend Rules

### Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code. No exceptions.

### Design System
- Light/cool gray theme: bg `#E2E5EE`, surfaces translucent `rgba(240,240,246,0.65)`, accent `#F7931A` (BTC orange) + `#3B82F6` (atmospheric blue, background only)
- Space Grotesk (headings, tracking `-0.04em`, line-height `1.1`) + Inter (body, weight `300`, line-height `1.8`)
- Bloomberg terminal / editorial aesthetic
- Mobile-first, `max-w-3xl`, information-dense
- Font variables: `--font-space-grotesk`, `--font-inter` (set in `layout.tsx`)

### Brand Assets
- Check `brand_assets/` before designing. Use real assets over placeholders.

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

## Pre-Deployment Checklist
- [x] Set `NEXT_PUBLIC_SITE_URL` to production domain (`getBaseUrl()` falls back to `https://www.btctoday.co`)
- [ ] Set all env vars in Vercel/hosting provider (never commit `.env`)
- [ ] Verify Supabase RLS policies are applied (`001_initial_schema.sql`)
- [ ] Verify `digest@btctoday.co` domain is verified in Resend
- [ ] Add `error.tsx` and `not-found.tsx` for branded error pages
- [ ] Add rate limiting to `/api/chat` (unthrottled Claude proxy risk)
- [ ] Consider adding `middleware.ts` for security headers (CSP, X-Frame-Options)
- [ ] Remove unused dependency `youtube-transcript` from `package.json`
