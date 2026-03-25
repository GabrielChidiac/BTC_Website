# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
AI-curated daily Bitcoin intelligence for high-net-worth individuals and business executives. Runs a Trigger.dev pipeline at 6 AM CET that collects news and market data, processes through Claude Sonnet into a structured briefing, enriches via Perplexity (institutional flows, expert insights, supply dynamics), and publishes to a Next.js site + email subscribers.

**Target audience:** Busy executives, HNW individuals, institutional investors. Not beginners. Write peer-to-peer with sophisticated investors. Let the data speak for itself — no hype, no hand-holding.

## Tech Stack
| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, ISR) | `next@16.2.1`, React 19 |
| Pipeline | Trigger.dev v3 (`@trigger.dev/sdk@^4.4.3`) | Cron tasks, 5min max per task |
| Database | Supabase (Postgres + RLS) | `@supabase/ssr@^0.9.0` |
| Styling | Tailwind CSS v4 | CSS-only config via `@theme` |
| AI | Claude Sonnet (briefing) + Perplexity sonar-pro (enrichment) | Kie.ai fallback for Claude |
| Email | Resend + React Email | |
| Language | TypeScript (strict) | |

## Dev Commands
```bash
npm run dev                   # Next.js at http://localhost:3000
npm run build                 # Production build (verifies all types)
npx trigger.dev@latest dev    # Trigger.dev local runner
```

Path alias: `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Documentation
- [docs/plan.md](docs/plan.md) — Implementation plan
- [docs/architecture.md](docs/architecture.md) — Full file tree, data flow
- [docs/decisions.md](docs/decisions.md) — Key technical decisions
- [docs/orchestrator.md](docs/orchestrator.md) — Pipeline orchestrator reference
- [docs/deployment.md](docs/deployment.md) — Deployment guide

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
- Cron: `"0 5 * * *"` (5 UTC = 6 CET)
- Max duration: 5 min per task (`trigger.config.ts`)
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

### Native fetch
- All HTTP calls use native `fetch` — no axios

## Environment Variables
All listed in `.env.example`. Required keys:
| Key | Service |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Sonnet (briefing generation) |
| `PERPLEXITY_API_KEY` | sonar-pro (enrichment: forward outlook, institutional flows, expert insights, supply dynamics) |
| `KIE_API_KEY` | Kie.ai (Claude fallback, OpenAI-compatible) |
| `SEARCHAPI_KEY` | SearchAPI.io (Google News) |
| `COINGECKO_API_KEY` | CoinGecko Demo (free, `x-cg-demo-api-key` header) |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage (DXY, free 25 req/day) |
| `TRIGGER_SECRET_KEY` | Trigger.dev |
| `RESEND_API_KEY` | Resend (email) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side writes) |
| `REVALIDATION_SECRET` | Protects `/api/revalidate` endpoint |
| `NEXT_PUBLIC_SITE_URL` | Site URL (default: `http://localhost:3000`) |

## Pipeline Architecture
```
6 AM CET daily (Trigger.dev cron):

  ┌─ news collector ──────┐
  │  (SearchAPI + RSS)     │
  │                        │──→ AI Brain (Claude) ──→ Enrichment (Perplexity x4)
  └─ market collector ─────┘         │                       │
     (CoinGecko, Mempool,           │                       ├── looking_ahead
      Yahoo, Alpha Vantage)         v                       ├── institutional_flows
                               BriefingJSON ◄───────────────├── expert_insights
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
- Light/platinum theme: bg `#F4F3F1`, surfaces `#FFFFFF`/`#F9F8F6`, accent `#F7931A` (BTC orange) + `#3B82F6` (atmospheric blue, background only)
- Space Grotesk (headings, tracking `-0.03em`, line-height `1.2`) + IBM Plex Sans (body, line-height `1.7`)
- Bloomberg terminal / editorial aesthetic
- Mobile-first, `max-w-3xl`, information-dense
- Font variables: `--font-space-grotesk`, `--font-ibm-plex-sans` (set in `layout.tsx`)

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
