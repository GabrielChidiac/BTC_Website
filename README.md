# BTC Today

AI-curated daily Bitcoin intelligence for busy BTC holders. A 2 AM CET pipeline collects news + market data, runs it through Claude Sonnet, enriches with Perplexity, generates a 4-minute audio brief, and publishes to a Next.js site + email subscribers.

**Promise:** every text brief reads in under 3 minutes, every audio brief in under 4. No hype, no tribal crypto voice, no ELI5. Peer-to-peer with a professional adult.

**Audience:** doctors, lawyers, founders, engineers, wealth advisors who own Bitcoin and have no time to follow the market. Not crypto-native, not institutional HNW.

Live at [btctoday.co](https://btctoday.co).

## Quick start

```bash
npm install
cp .env.example .env.local            # fill in keys
npm run dev                           # Next.js at http://localhost:3000
npx trigger.dev@latest dev            # pipeline runner (separate terminal)
```

Required services: Anthropic, Perplexity, Kie.ai (Claude fallback), OpenAI (TTS), CoinGecko, SearchAPI, Jina Reader, Trigger.dev, Resend, Supabase, Stripe, CoinOS (Lightning tipping).

`npm run build` is the only type-safety gate — no test runner, linter, or formatter is configured.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, ISR), React 19, TypeScript strict |
| Pipeline | Trigger.dev v3 (cron tasks, `maxDuration: 900`) |
| Database | Supabase (Postgres + RLS), `@supabase/ssr` |
| Styling | Tailwind CSS v4 (CSS-only config via `@theme`) |
| AI | Claude Sonnet (briefing) + Perplexity sonar-pro (enrichment) + OpenAI `gpt-4o-mini-tts` (audio) |
| Payments | Stripe Payment Links ($7/mo or $59/yr) |
| Email | Resend + React Email |
| Tipping | Lightning Network via CoinOS |
| UI | shadcn/ui (base-nova), Framer Motion, GSAP |

## Repository layout

```
src/
  app/              Next.js App Router (pages, API routes, /listen, /pdf)
  components/       React components (shadcn/ui + custom)
  lib/              Supabase clients, schemas, tier gating, session, lightning
  trigger/          Trigger.dev pipeline tasks
    collectors/       news + market data fetchers
    processors/       triage, day-classifier, analyst, synthesizer, market-signals
    publishers/       save-briefing, send-digest, send-weekly-recap, resolve-predictions
    audio-brief/      script prompts + TTS orchestration
    lib/              anthropic, openai-tts, fetch-timeout
  proxy.ts          Next.js 16 middleware (security headers)
emails/             React Email templates (daily digest, weekly recap, welcome)
supabase/migrations Schema migrations
docs/               architecture, deployment, decisions
```

Path alias: `@/*` → `./src/*`.

## Pipeline (3 AM CET)

Defined in [src/trigger/daily-pipeline.ts](src/trigger/daily-pipeline.ts):

```
collectors (news + market, parallel)
  → triage + perplexityCrossRef (parallel) → mergeTriageWithCrossRef → Jina scrape
  → day-classifier (precursor signal, non-fatal)
  → analyst (regime, drivers, technical posture; non-fatal)
  → synthesizer (Claude → BriefingJSON; data-derived fallback if Claude fails)
  → enrichment (Perplexity ×4: looking_ahead, institutional_flows, expert_insights, supply_dynamics)
  → market-signals (Postgres-backed regime + funding callouts, max 2)
  → audio brief (Claude script + OpenAI TTS → briefing-audio bucket)
  → health gate (non-blocking)
  → save (briefing + predictions) → revalidate (ISR) → send digest (Resend)
```

A separate `resolve-predictions` cron runs at 03:00 UTC (2h after the pipeline) to auto-score directional predictions for the day-60 accuracy scorecard.

**Fault tolerance:** collectors, triage, analyst, enrichment, audio brief, and market-signals are non-fatal — failures default to fallback values. Synthesizer is mostly fatal but has a deterministic data-derived fallback when Claude exhausts. Publishers are sequential: if save fails, the email is never sent.

## Subscription tiers

| | Free | Pro ($7/mo or $59/yr) |
|---|---|---|
| Homepage | Sections 01–04 | All sections |
| Archive | Last 7 days | All dates |
| PDF | — | Yes |
| Audio brief | — | Yes |
| Weekly recap | Yes | — |

Founding members (`is_founding_member` flag, capped by `FOUNDING_MEMBER_LIMIT`) get a different welcome email. Auth is magic-link only (10-min token expiry, 30-day session cookie, max 3 concurrent sessions per email).

## Database

6 tables in [supabase/migrations/](supabase/migrations/). RLS: briefings publicly readable, all others service-role only.

- `daily_briefings` — date PK + JSONB content
- `subscribers` — email, tier, status, founding flag
- `verification_codes` — magic-link tokens + session tokens
- `predictions` — silent collection for the day-60 accuracy scorecard
- `rate_limits` — IP-bucketed counters (fail-open)
- `lightning_tips` — CoinOS invoices with payment-hash polling

## Core conventions

- **`Result<T>` everywhere.** API wrappers never throw — they return `{ data, error }`.
- **`@supabase/ssr` only.** Never import `@supabase/supabase-js` directly. Use `createServerClient()` for RSC, `createServiceClient()` for Trigger tasks, `createClient()` for client components.
- **`.maybeSingle()` always.** Never `.single()` (throws on 0 results).
- **Trigger.dev:** use `batch.triggerAndWait()` for parallel sub-tasks. Never `Promise.all` with individual `triggerAndWait` calls.
- **Tailwind v4:** config in `src/app/globals.css` via `@theme`. No `tailwind.config.js`.
- **No user-facing Claude chat.** Pipeline only.

## Design system

Light/cool gray theme — bg `#E2E5EE`, accent `#F7931A` (BTC orange) + `#3B82F6` (atmospheric blue). Space Grotesk (headings, tracking `-0.04em`) + Inter (body, weight `300`). Bloomberg-terminal / editorial aesthetic. Mobile-first, `max-w-3xl`, information-dense.

Animation rules: only `transform` and `opacity`. Never `transition-all`. Spring easing.

## Deployment

Vercel for the Next.js app, Trigger.dev for the pipeline (deploys on push to `main`). Stripe webhook URL: `https://btctoday.co/api/webhooks/stripe`. Full checklist in [docs/deployment.md](docs/deployment.md).

