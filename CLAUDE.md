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
AI-curated daily Bitcoin intelligence for busy BTC holders who have jobs. A Trigger.dev pipeline runs at 2 AM CET, collects news + market data, processes through Claude Sonnet, enriches via Perplexity (institutional flows, expert insights, supply dynamics), and publishes to a Next.js site + email subscribers. A 4-minute Pro audio brief (Pillar 2 of the 2026-04-13 pivot) is the primary Pro differentiator.

**Target audience:** Busy professionals who own Bitcoin and do not have time. Doctors, lawyers, founders, engineers, corporate managers, wealth advisors. Not crypto-native. Not institutional HNW (different pricing/distribution). The product promise is ruthless time-respect: every text brief finishes in under 3 minutes, every audio brief in under 4. Write peer-to-peer with a professional adult, not a Crypto Twitter degen. Let the data speak for itself. No hype, no hand-holding, no tribal crypto voice.

## Tech Stack
| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, ISR) | `next@16.2.3`, React 19 |
| Pipeline | Trigger.dev v3 (`@trigger.dev/sdk@4.4.4`) | Cron tasks, `maxDuration: 900` (15 min) |
| Database | Supabase (Postgres + RLS) | `@supabase/ssr@^0.9.0` |
| Styling | Tailwind CSS v4 | CSS-only config via `@theme` |
| AI | Claude Sonnet (briefing) + Perplexity sonar-pro (enrichment) + OpenAI `gpt-4o-mini-tts` (audio) | Kie.ai fallback for Claude |
| Payments | Stripe (Payment Links) | $7/month or $59/year |
| Email | Resend + React Email | |
| UI | shadcn/ui (base-nova), Framer Motion, GSAP | Animate only `transform`/`opacity` |
| TA | trading-signals | RSI-14, SMA-50, SMA-200 |
| Language | TypeScript (strict) | No tests or linter configured |

## Dev Commands
```bash
npm run dev                   # Next.js at http://localhost:3000
npm run build                 # Production build (verifies all types)
npx trigger.dev@latest dev    # Trigger.dev local runner
```
Path alias `@/*` → `./src/*`. CI in `.github/workflows/trigger-deploy.yml` deploys Trigger.dev tasks on push to `main`.

## Documentation
[docs/plan.md](docs/plan.md), [docs/architecture.md](docs/architecture.md), [docs/decisions.md](docs/decisions.md), [docs/orchestrator.md](docs/orchestrator.md), [docs/deployment.md](docs/deployment.md), [docs/design-brief.md](docs/design-brief.md).

## Working Rules
- **Always verify before writing.** Read schemas, types, and existing code before writing any new code. Never assume a field, type, or pattern exists — confirm it first.
- **This file must stay ≤230 lines.** When editing CLAUDE.md, run `wc -l CLAUDE.md` afterwards. If it exceeds 230, compress before finishing — collapse repetition, drop discoverable details, never split into a second doc.

## Critical Patterns

### Result type
All API wrappers return `Result<T>` and never throw.
```typescript
type Result<T> = { data: T; error: null } | { data: null; error: string };
```

### Trigger.dev
- Use `batch.triggerAndWait()` for parallel sub-tasks. **Never** `Promise.all` with individual `triggerAndWait` calls. `Promise.allSettled` is fine inside wrapper functions.
- Cron `"0 1 * * *"` (1 UTC = 2 CET). Task files live in `src/trigger/` (configured via `dirs` in `trigger.config.ts`).

### Supabase
- `@supabase/ssr` only — never import `@supabase/supabase-js` directly.
- `createServerClient()` for Server Components (respects RLS). `createServiceClient()` for Trigger tasks + API route handlers (bypasses RLS via `SUPABASE_SERVICE_ROLE_KEY`). `createClient()` for client components. All in `src/lib/supabase/`.
- **Always `.maybeSingle()`** for single-row queries — never `.single()` (throws on 0 results).

### Tailwind v4
- Config lives in `src/app/globals.css` via `@import "tailwindcss"` + `@theme inline`. **No `tailwind.config.js`.**
- Custom CSS variables defined in `@theme`: `--color-bg-base`, `--color-accent`, `--font-heading`, etc.

### Claude API
- Used only inside the Trigger.dev pipeline (AI Brain). No user-facing chat endpoint.
- `callClaudeJSON<T>()` ([src/trigger/lib/anthropic.ts](src/trigger/lib/anthropic.ts)) auto-retries once with a "fix your JSON" prompt on parse failure. Fallback chain: Anthropic SDK → Kie.ai (OpenAI-compatible) on 429/5xx. All wrappers return `Result<T>`.
- All HTTP uses native `fetch` — no axios.

### Authentication
- **Magic link only**, no passwords. Tokens have a 10-min expiry and are not consumed on use.
- `verify-send` issues a magic link → `verify-check` validates the token, confirms the subscriber is active, and creates a 30-day session. Session cookie `btc-session`: httpOnly, secure in prod, sameSite lax.
- Session tokens stored as `session:<uuid>` in `verification_codes.code`; cookie is `{ email, token }` JSON. **Max 3 concurrent sessions per email** — oldest evicted on 4th login.
- `/pdf/[date]` and `/api/audio/[date]` accept either the session cookie or a magic-link token via `?token=...&email=...` query params. All email links share the same per-subscriber token.
- `getBaseUrl()` ([src/lib/url.ts](src/lib/url.ts)) resolves the site URL — never falls back to localhost.
- Cookie helpers in [src/lib/session.ts](src/lib/session.ts): `COOKIE_NAME = "btc-session"`, `setSessionCookie()`, `clearSessionCookie()`. Import from here instead of constructing cookies inline.

### Subscription tiers (Free / Pro)
- Stored in `subscribers.tier` (`'free'` | `'pro'`); status in `subscribers.status` (`'active'` | `'inactive'` | `'pending'`).
- `getSubscriberTier()` ([src/lib/tier.ts](src/lib/tier.ts)) reads the session cookie → checks tier.
- Stripe handles payments via webhook at `/api/webhooks/stripe`; `verifyStripeWebhook()` ([src/lib/stripe.ts](src/lib/stripe.ts)) validates Stripe webhook signatures. Webhook handles `checkout.session.completed` (→ pro) / `customer.subscription.deleted` (→ free) and auto-creates the subscriber if missing.
- All existing active subscribers were gifted Pro tier at launch.
- **Founding members:** `is_founding_member` boolean on `subscribers`; `FOUNDING_MEMBER_LIMIT` in [src/lib/constants.ts](src/lib/constants.ts); `getFoundingMemberStatus()` ([src/lib/founding.ts](src/lib/founding.ts)) checks remaining spots. Founding members get `founding-welcome.tsx`; other Pro subscribers get `pro-welcome.tsx`.

**Tier gating rules (scattered across the codebase — keep them straight):**
- **Homepage:** Free sees sections 01–04 (hero, market, what happened, top stories). Sections 05–07 (adoption/regulatory, deep dive, looking ahead) sit behind `ProTeaser` blur.
- **Archive list:** Free sees only the last 7 days. Pro sees all dates.
- **Archive [date]:** ≤7 days → free-tier sections shown, pro-only sections show `ProGateCompact`. >7 days → free sees only DailyDiff + MarketSnapshot.
- **PDF + audio brief:** Pro only. `/listen/[date]` server-side gates via `getSubscriberTier()` and redirects non-Pro to `/pricing`. `/api/audio/[date]` re-checks tier per request.

## Environment Variables
All keys live in `.env.example`. Services: Anthropic, Perplexity, Kie.ai (Claude fallback), OpenAI (TTS for the audio brief), CoinGecko, SearchAPI, Jina Reader, Trigger.dev, Resend, Supabase, Stripe.

## Database (Supabase)
5 tables in [supabase/migrations/](supabase/migrations/). RLS: briefings publicly readable, all others service-role only.
- `daily_briefings` — date PK + JSONB content
- `subscribers` — email, tier, status, founding flag
- `verification_codes` — magic-link tokens + session tokens
- `predictions` — silent data collection for the day-60 accuracy scorecard. Stores 2–3 directional claims per briefing (`claim_text`, `direction`, `metric`, `target_date`, `resolution_status`). **No user-facing UI yet.**
- `rate_limits` — IP-bucketed counters for `src/lib/rate-limit.ts` (fail-open). Incremented via the `increment_rate_limit` Postgres RPC.

## API Routes
Routes in [src/app/api/](src/app/api/): subscribe + subscribe/verify, unsubscribe, revalidate (ISR), auth/verify-send + auth/verify-check, logout, webhooks/stripe, audio/[date] (Pro — returns a 1-hour signed Supabase Storage URL for the day's MP3; 404 if missing; redirects non-Pro to `/pricing`). `/pdf/[date]` is a **page** route at [src/app/pdf/[date]](src/app/pdf/[date]/) (renders via `@react-pdf/renderer`), not an API handler. Public routes go through `checkRateLimit()` + `getClientIp()` from [src/lib/rate-limit.ts](src/lib/rate-limit.ts) — the limiter fails **open** on errors, with HMAC/auth as a second layer.

## Pipeline Architecture
2 AM CET cron in [daily-pipeline.ts](src/trigger/daily-pipeline.ts):
```
collectors (news + market, parallel via batch.triggerAndWait)
  → triage + perplexityCrossRef (parallel) → mergeTriageWithCrossRef → Jina scrape
  → AI Brain (Claude → BriefingJSON)
  → enrichment (Perplexity ×4: looking_ahead, institutional_flows, expert_insights, supply_dynamics)
  → computeReadTimeSeconds()
  → audio brief (Claude script + OpenAI TTS → briefing-audio bucket)
  → save (briefing + predictions)
  → revalidate Next.js (ISR)
  → send digest (Resend)
```
- Collectors run **parallel**. Everything after runs **sequential**.
- [src/trigger/lib/fetch-timeout.ts](src/trigger/lib/fetch-timeout.ts) provides `fetchWithTimeout()` / `withTimeout()`.
- Triage rankings ([src/trigger/processors/triage.ts](src/trigger/processors/triage.ts)) are passed to AI Brain via `triageContext` as a *signal*, not a hard filter — Claude is free to override.

**Fault tolerance:**
- Collectors / triage / enrichment / audio brief: **non-fatal** — failures default to fallback values; pipeline ships without the missing piece.
- Enrichment runs its 4 Perplexity queries in parallel **inside one** Trigger task via `Promise.allSettled` — not as 4 subtasks.
- AI Brain: **FATAL** — if Claude fails, no briefing is published.
- Publishers: **sequential** — if save fails, email is never sent.

**BriefingJSON composition** (see [src/lib/types.ts](src/lib/types.ts)):
- AI Brain generates the base structure (stories, market, technical, narrative, macro, etc.) plus `looking_ahead_predictions` (2–3 testable directional claims).
- Enrichment overwrites `looking_ahead`, `institutional_flows`, `expert_insights`, `supply_dynamics`. `institutional_flows` from Perplexity focuses on **non-ETF** activity (corporate treasury, whales, fund allocations, OTC, mining).
- `etf_flows` comes straight from the market collector (not AI Brain or enrichment).
- `read_time_seconds` is computed by `computeReadTimeSeconds()` ([src/lib/utils.ts](src/lib/utils.ts)) after enrichment — powers the 3-minute contract display.
- `hero_three_lines`, `audio_url`, `audio_duration_seconds`, `audio_script` are populated by the audio brief step.
- `looking_ahead_predictions` is also persisted to the `predictions` table by [save-briefing.ts](src/trigger/publishers/save-briefing.ts) (try/catch wrapped — failure does not block the briefing save).

**Audio brief (Pillar 2):**
- Script generated by Claude via prompts in [src/trigger/audio-brief/prompts.ts](src/trigger/audio-brief/prompts.ts), then synthesized to MP3 by OpenAI `gpt-4o-mini-tts` + `coral` voice with a `VOICE_INSTRUCTIONS` steering block ([openai-tts.ts](src/trigger/lib/openai-tts.ts)). MP3s land in Supabase Storage bucket `briefing-audio` as `YYYY-MM-DD.mp3`.
- Target: 350–500 words (~4 min @ 150 WPM), 9-section structure (OPEN, MARKET SNAPSHOT, TOP STORIES, ADOPTION, REGULATORY, INSTITUTIONAL FLOWS, DEEP DIVE, OUTLOOK, CLOSE). Section markers like `[OPEN]` are stripped before TTS so brackets are not read aloud.
- **FACTS BLOCK** anti-hallucination pattern: the prompt feeds Claude plain-text enumerated facts (not JSON) so Claude is forced to use *today's* data instead of training-data priors.

**News pipeline:** Articles deduped by normalized URL (lowercase, trimmed), filtered by BTC-relevance regex, then ranked + scraped by the triage processor (Jina Reader full text, non-fatal per article).

**Email & PDF:**
- Daily digest batched in chunks of 100 (Resend limit). PDF via `@react-pdf/renderer` → Supabase Storage bucket `briefing-pdfs`.
- `send-weekly-recap` runs Sunday 9 AM UTC to free-tier only. Date range: Saturday back 6 days (previous Sunday → Saturday) to skip Sunday's missing briefing.
- Daily-digest + weekly-recap use the `%%UNSUBSCRIBE_URL%%` placeholder, replaced per-subscriber with a magic-token sign-in URL. Welcome email links to `/sign-in` (no token at subscribe time).
- Templates in `emails/`. Contact email: `hello@btctoday.co`.

## Removed: AI chat feature
The user-facing Claude chat was intentionally removed (2026-04-12). `ANTHROPIC_API_KEY` and `KIE_API_KEY` are pipeline-only now. **Never** suggest adding a chat route, component, or CTA.

## Frontend Rules
- **Invoke the `frontend-design` skill** before writing any frontend code. No exceptions.
- Check `public/` for static assets before designing — use real assets over placeholders.

**Design system:** Light/cool gray theme — bg `#E2E5EE`, surfaces `rgba(240,240,246,0.65)`, accent `#F7931A` (BTC orange) + `#3B82F6` (atmospheric blue, background only). Space Grotesk (headings, tracking `-0.04em`, line-height `1.1`) + Inter (body, weight `300`, line-height `1.8`). Bloomberg-terminal / editorial aesthetic. Mobile-first, `max-w-3xl`, information-dense. Font vars `--font-space-grotesk`, `--font-inter`, `--font-sans` (Geist) set in `layout.tsx`.

**Anti-generic guardrails:**
- **Colors:** Never default Tailwind palette. Derive from brand orange + blue.
- **Typography:** Different fonts for headings vs body. Always.
- **Shadows:** Layered, color-tinted, low opacity. Never flat `shadow-md`.
- **Gradients:** Layer multiple radial gradients. Add SVG noise for texture.
- **Animations:** Only `transform` / `opacity`. **Never `transition-all`.** Spring easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, active.
- **Spacing:** Consistent tokens, no random Tailwind steps. Layering: base → elevated → floating.
- **Images:** Gradient overlay (`from-black/60`) + `mix-blend-multiply` color layer.

**Hard rules:** Do not add sections/features beyond what's in the reference. Do not use `transition-all`. Do not use default Tailwind blue/indigo as primary color.

**Reference images:** If provided, match exactly — do not "improve". If not provided, design from scratch per guardrails.

## Content Philosophy
- **Quality over quantity** — fewer sections, each must be top-notch.
- **No basic education** — no "What is mining?" or ELI5.
- **Institutional lens** — frame everything through where money flows, macro implications, long-term value.
- **Anti-skeptic by data** — let BTC vs Everything (24h, YTD, 1Y) speak for itself.
- **Expert voices** — Perplexity-sourced from recognized analysts (Lyn Alden, Saylor), not YouTube influencers.

## Pages
| Route | Purpose |
|---|---|
| `/` | Latest briefing (homepage) |
| `/archive`, `/archive/[date]` | Briefing archive |
| `/listen/[date]` | Pro-only audio player ([AudioPlayer.tsx](src/components/player/AudioPlayer.tsx)). Falls back to "Audio unavailable" if `audio_url` is null. |
| `/pdf/[date]` | PDF download (Pro only) |
| `/sign-in`, `/pricing`, `/privacy`, `/terms` | Standard pages |

## Deployment
See [docs/deployment.md](docs/deployment.md). Production TODOs: env vars in Vercel; Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_MONTHLY_URL`, `NEXT_PUBLIC_STRIPE_ANNUAL_URL`); webhook URL in Stripe dashboard → `https://btctoday.co/api/webhooks/stripe`.
