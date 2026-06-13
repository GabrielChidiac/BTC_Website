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
AI-curated daily Bitcoin intelligence for busy BTC holders who have jobs. A Trigger.dev pipeline runs at 2 AM CET, collects news + market data, processes through Claude Sonnet, enriches via Perplexity (institutional flows, expert insights, supply dynamics), and publishes to a Next.js site + email subscribers.

**Target audience:** Busy professionals who own Bitcoin and do not have time. Doctors, lawyers, founders, engineers, corporate managers, wealth advisors. Not crypto-native. Not institutional HNW (different pricing/distribution). The product promise is ruthless time-respect: every text brief finishes in under 3 minutes. Write peer-to-peer with a professional adult, not a Crypto Twitter degen. Let the data speak for itself. No hype, no hand-holding, no tribal crypto voice.

## Tech Stack
| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, ISR) | `next@16.2.3`, React 19 |
| Pipeline | Trigger.dev v3 (`@trigger.dev/sdk@4.4.4`) | Cron tasks, `maxDuration: 900` (15 min) |
| Database | Supabase (Postgres + RLS) | `@supabase/ssr@^0.9.0` |
| Styling | Tailwind CSS v4 | CSS-only config via `@theme` |
| AI | Claude Sonnet (briefing) + Perplexity sonar-pro (enrichment) | Kie.ai fallback for Claude |
| Payments | Stripe (Payment Links) | $7/month or $59/year |
| Email | Resend + React Email | |
| Tipping | Lightning Network via CoinOS | `btctoday@coinos.io`; auto-sweep to BitBox02 at 500k sats; polling not webhooks |
| UI | shadcn/ui (base-nova), Framer Motion, GSAP | Animate only `transform`/`opacity` |
| TA | trading-signals | RSI-14, SMA-50, SMA-200 |
| Language | TypeScript (strict) | No tests or linter configured |

## Dev Commands
```bash
npm run dev                   # Next.js at http://localhost:3000
npm run build                 # Production build (verifies all types)
npm run start                 # Serve the production build
npx trigger.dev@latest dev    # Trigger.dev local runner
```
Path alias `@/*` → `./src/*`. No test runner, linter, or formatter is configured — `npm run build` is the only type-safety gate. CI deploys Trigger.dev on push to `main`. Project-local skills in `Skills/` (incl. `analyst-review` for periodic Synthesizer-rewrite-readiness checks). Supabase MCP is wired (read-only, OAuth-authed) — query `daily_briefings` directly during debugging instead of asking the user to paste rows. Seed a test briefing via `scripts/seed-test-briefing.sql`.

## Working Rules
- **Always verify before writing.** Read schemas, types, and existing code before writing any new code. Never assume a field, type, or pattern exists — confirm it first.
- **This file must stay ≤230 lines.** When editing CLAUDE.md, run `wc -l CLAUDE.md` afterwards. If it exceeds 230, compress before finishing — collapse repetition, drop discoverable details, never split into a second doc.
- **Read [Marketing.md](Marketing.md) before any marketing move.** Applies to copy, channel choices, positioning, launch plans, growth tactics, audience messaging, partnership outreach — anything reader-facing or distribution-related. Read it first; don't propose from priors.
- **Memory is source of truth; CLAUDE.md is broadcast.** When saving a memory that sets a value (WPM, word count, field name, length cap, bucket name, etc.) also referenced here, update both in the same turn. Memories in `/Users/gab/.claude/projects/-Users-gab-Documents-BTC-Website/memory/` are auto-injected every session; ignoring them is not an option.
- **Before editing governed files, re-read relevant memories.** Files covered: `src/trigger/**`, `emails/**`, `src/lib/schemas.ts`, `src/lib/types.ts`, `CLAUDE.md`. The one-line MEMORY.md index is not enough — open the feedback memory body.
- **Scoped CLAUDE.md files** live in `agents/`, `src/trigger/`, `src/trigger/{collectors,processors,publishers,lib}/`, `src/lib/`, `src/lib/supabase/`, `emails/`, and `supabase/migrations/`. They carry directory-local conventions; this root file holds the global rules. When editing inside a directory, read its scoped file first.

## Load-Bearing Features (do not remove without explicit confirmation)
These are core product features or pipeline steps whose removal requires an explicit user decision in the current session — never inferred from adjacent tasks, never "cleanup", never silent refactor:
- **BriefingJSON enrichment fields:** `expert_insights`, `institutional_flows`, `supply_dynamics`, `looking_ahead`, `looking_ahead_predictions`.
- **Day classifier** ([day-classifier.ts](src/trigger/processors/day-classifier.ts)) and its `dayContext` feed into Synthesizer.
- **Founding member mechanic:** `is_founding_member` flag, `FOUNDING_MEMBER_LIMIT`, `founding-welcome.tsx`, founding-count UI.
- **Weekly recap email** for free tier.
- **Predictions table + `resolve-predictions` cron** (day-60 accuracy scorecard feed).
- **Lightning tipping:** `/tip` page, `/api/tips/invoice` + `/api/tips/[hash]`, `lightning_tips` table, `src/lib/lightning.ts` CoinOS wrapper, tip CTA in daily digest + weekly recap.
If a task looks like it touches any of these, stop and confirm with the user before proceeding.

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
- Used only inside the Trigger.dev pipeline. No user-facing chat endpoint.
- `callClaudeJSON<T>()` ([src/trigger/lib/anthropic.ts](src/trigger/lib/anthropic.ts)) chain: Anthropic SDK → Kie.ai on 429/5xx → parse → optional `schema` (zod) validation → optional `retryOnSchemaError` correction retry. All return `Result<T>`.
- Zod schemas for every Claude output live in [src/lib/schemas.ts](src/lib/schemas.ts). Keep in sync with types.ts. Pass `retryOnSchemaError: true` on fatal/load-bearing tasks (Synthesizer, Analyst); non-fatal tasks save the retry tokens.
- **Task payload guards:** every Trigger task that receives structured payloads normalizes `payload?.field ?? default` at entry. Never assume the dashboard test payload is well-formed.
- All HTTP uses native `fetch` — no axios.

### Authentication
- **Magic link only**, no passwords. Tokens have a 10-min expiry and are not consumed on use.
- `verify-send` issues a magic link → `verify-check` validates the token, confirms the subscriber is active, and creates a 30-day session. Session cookie `btc-session`: httpOnly, secure in prod, sameSite lax.
- Session tokens stored as `session:<uuid>` in `verification_codes.code`; cookie is `{ email, token }` JSON. **Max 3 concurrent sessions per email** — oldest evicted on 4th login.
- `/pdf/[date]` accepts either the session cookie or a magic-link token via `?token=...&email=...` query params. All email links share the same per-subscriber token.
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
- **PDF:** Pro only. `/pdf/[date]` server-side gates via `getSubscriberTier()` and redirects non-Pro to `/pricing`.

## Environment Variables
All keys live in `.env.example`. Services: Anthropic, Perplexity, Kie.ai (Claude fallback), CoinGecko, SearchAPI, Jina Reader, Trigger.dev, Resend, Supabase, Stripe.

## Database (Supabase)
6 tables in [supabase/migrations/](supabase/migrations/). RLS: briefings publicly readable, all others service-role only.
- `daily_briefings` — date PK + JSONB content
- `subscribers` — email, tier, status, founding flag
- `verification_codes` — magic-link tokens + session tokens
- `predictions` — silent data collection for the day-60 accuracy scorecard. 2–3 directional claims per briefing. Auto-resolved daily at 03:00 UTC by [resolve-predictions.ts](src/trigger/publishers/resolve-predictions.ts): BTC-price metrics scored via CoinGecko historical close, ±2% flat band; other metrics marked `inconclusive` with a reason. No user-facing UI yet.
- `rate_limits` — IP-bucketed counters for `src/lib/rate-limit.ts` (fail-open). Incremented via the `increment_rate_limit` Postgres RPC.
- `lightning_tips` — Lightning tip invoices generated via CoinOS. `payment_hash` (unique), `bolt11`, `amount_sats`, optional `message` + `briefing_date`, `paid` flag flipped on poll confirmation. No FK on briefing_date (decoupled from briefing lifecycle).

## API Routes
Routes in [src/app/api/](src/app/api/): subscribe + subscribe/verify, unsubscribe, revalidate (ISR), auth/verify-send + auth/verify-check, logout, webhooks/stripe. `/pdf/[date]` is a **page** route at [src/app/pdf/[date]](src/app/pdf/[date]/) (renders via `@react-pdf/renderer`), not an API handler. Public routes go through `checkRateLimit()` + `getClientIp()` from [src/lib/rate-limit.ts](src/lib/rate-limit.ts) — the limiter fails **open** on errors, with HMAC/auth as a second layer.

**Middleware:** [src/proxy.ts](src/proxy.ts) (Next.js 16 renamed `middleware.ts` → `proxy.ts`) sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS on every non-static response. Edit here, not per-route, for global security headers.

## Pipeline Architecture
2 AM CET cron in [daily-pipeline.ts](src/trigger/daily-pipeline.ts):
```
collectors (news + market, parallel via batch.triggerAndWait)
  → triage + perplexityCrossRef (parallel) → mergeTriageWithCrossRef → Jina scrape
  → day-classifier (precursor signal, non-fatal)
  → analyst (NEW; non-fatal, deterministic fallback; AnalysisBlock telemetry to Synthesizer)
  → Synthesizer (Claude → BriefingJSON; data-derived fallback if Claude fails)
  → enrichment (Perplexity ×4: looking_ahead, institutional_flows, expert_insights, supply_dynamics)
  → market-signals (Postgres-backed regime + funding callouts, max 2 shown)
  → computeReadTimeSeconds()
  → health gate (non-blocking)
  → save (briefing + predictions) → revalidate (ISR) → send digest (Resend)
```
- Collectors run **parallel**. Everything after runs **sequential**.
- [src/trigger/lib/fetch-timeout.ts](src/trigger/lib/fetch-timeout.ts) provides `fetchWithTimeout()` / `withTimeout()`.
- Triage rankings ([triage.ts](src/trigger/processors/triage.ts)) are passed to Synthesizer via `triageContext` as a *signal*, not a hard filter — Claude is free to override.
- Day classifier ([day-classifier.ts](src/trigger/processors/day-classifier.ts)) produces `DayClassification` {label, depth_weight, day_tone_line} used as `dayContext` for Synthesizer. Reads last 7 days from Supabase for historical smoothing.
- Analyst ([analyst.ts](src/trigger/processors/analyst.ts)) produces `AnalysisBlock` (regime, drivers, technical posture, macro assessment, risk-changed gate). NEW; passed to Synthesizer as `analysisContext` for telemetry only — prompt does not yet consume it (side-by-side validation phase). `validateAnalystRiskChangeEarned` enforces earned-significance with one correction retry.
- Expert framework ([expert-context.ts](src/trigger/processors/expert-context.ts), `EXPERT_CONTEXT`) is a ~2500-word analytical prior fed to Synthesizer + Analyst as user-prompt reference. Edit to shift the briefing's analytical lens. Never quoted verbatim.
- Market signals ([market-signals.ts](src/trigger/processors/market-signals.ts)) reads 30-day history from Supabase, applies cooldowns, and emits at most 2 callouts (correlation regime flips, funding extremes, F&G deltas). Tuned to fire rarely — quiet days with zero callouts are expected.
- Separate cron: `resolve-predictions` at 03:00 UTC (2h after pipeline) auto-scores due predictions.

**Fault tolerance:**
- Collectors / triage / analyst / enrichment / market-signals: **non-fatal** — failures default to fallback values.
- Enrichment runs 4 Perplexity queries in parallel **inside one** Trigger task via `Promise.allSettled` — not as 4 subtasks. Analyst has its own deterministic fallback (regime by 7d sign, conviction=30, no drivers).
- Synthesizer: **mostly fatal**. If Claude (Anthropic + Kie.ai) exhausts but market data is present, [fallback-template.ts](src/trigger/processors/fallback-template.ts) `buildFallbackBriefing()` produces a data-derived briefing. True hard fail only when both Claude AND market data are missing.
- Publishers: **sequential** — if save fails, email is never sent.

**BriefingJSON composition** (see [src/lib/types.ts](src/lib/types.ts)):
- Synthesizer generates the base structure (stories, market, technical, narrative, macro, etc.) plus `looking_ahead_predictions` (2–3 testable directional claims).
- Enrichment overwrites `looking_ahead`, `institutional_flows`, `expert_insights`, `supply_dynamics`. `institutional_flows` focuses on **non-ETF** activity (corporate treasury, whales, fund allocations, OTC, mining). `etf_flows` comes straight from the market collector (not Synthesizer or enrichment).
- `read_time_seconds` is computed by `computeReadTimeSeconds()` ([src/lib/utils.ts](src/lib/utils.ts)) but **no longer displayed anywhere user-facing** (removed 2026-04-28 to avoid promising a read time we cannot guarantee). Field kept in schema; do not re-add display surfaces without explicit user request.
- `looking_ahead_predictions` is also persisted to the `predictions` table by [save-briefing.ts](src/trigger/publishers/save-briefing.ts) (try/catch wrapped — failure does not block the briefing save).

**News pipeline:** Articles deduped by normalized URL (lowercase, trimmed), filtered by BTC-relevance regex, then ranked + scraped by the triage processor (Jina Reader full text, non-fatal per article).

**Email & PDF:**
- Daily digest batched in chunks of 100 (Resend limit). PDF via `@react-pdf/renderer` → Supabase Storage bucket `briefing-pdfs`.
- `send-weekly-recap` runs Sunday 9 AM UTC to free-tier only. Date range: Saturday back 6 days (previous Sunday → Saturday) to skip Sunday's missing briefing.
- Daily-digest + weekly-recap use the `%%UNSUBSCRIBE_URL%%` placeholder, replaced per-subscriber with a magic-token sign-in URL. Welcome email links to `/sign-in` (no token at subscribe time).
- Templates in `emails/`. Contact email: `hello@btctoday.co`.

## Anti-patterns (do not propose)
- **No user-facing Claude chat.** Removed 2026-04-12; `ANTHROPIC_API_KEY` and `KIE_API_KEY` are pipeline-only. Don't suggest a chat route, component, or CTA.
- **No `tailwind.config.js`** — Tailwind v4 is configured in `globals.css` only.
- **No `Promise.all` over `triggerAndWait`** — use `batch.triggerAndWait()`. `Promise.allSettled` inside a single task body is fine.
- **No `.single()`** on Supabase reads — use `.maybeSingle()`.

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

## Briefing Rules
**The Synthesizer system prompt in [synthesizer.ts](src/trigger/processors/synthesizer.ts) is the source of truth.** Read it when changing briefing behavior. Orientation:
- **5-item combined cap** across `top_stories + regulatory + adoption`, allocated by importance — not per-section quota. Soft floor of ~3 on quiet days.
- **Two-question reader contract:** `daily_diff.sentiment_shift` and `hero_three_lines.signal` must plainly answer (1) is today mostly noise? (2) did anything change near-term risk? No soft hedging.
- **Earned significance:** depth tracks `day_classifier.depth_weight` — quiet days read short and flat, thesis-shift days go deep.
- **Comparative anchoring:** quantitative claims must reference `market.comparative` baselines (30-day realized vol, price-vs-30d-avg, funding percentile, F&G delta, ETF flow z-score). No vague intensifiers without an anchor.
## Accuracy Gate (zero-unsourced-claims bar)
- **[accuracy-validators.ts](src/trigger/lib/accuracy-validators.ts)** exports 12 validators (directional, narrative, summaries, hero, etc.) chained in Synthesizer's `ensureDataConsistency` plus `validateAnalystRiskChangeEarned` chained in Analyst. One correction retry per stage on violation.
- **Source headline overwrite:** Synthesizer always overwrites `top_stories[].headline`, `regulatory[].headline`, `adoption[].headline` with verbatim source article titles. Claude cannot editorialize headlines; the architecture prevents it.
- **Directional truth block + approved headlines block** injected at the top of the Synthesizer user prompt: pre-computed approved/forbidden adjectives per 24h/7d period plus verbatim source titles.
- **Source URLs required on new writes for:** `expert_insights[].source_url`, `institutional_flows.notable_moves[].source_url`, `supply_dynamics.source_url`. Enrichment filters out items without valid https URLs. `ExpertInsightsArraySchema` is now `.max(3)` (no min) — empty array is valid; homepage renders an empty-state stub. Legacy Supabase rows without URLs still render (polymorphic type).
- **Looking-ahead calendar constraint:** enrichment injects `buildCountdownFactsBlock(date, 90)` so Perplexity can only reference scheduled catalysts from our calendar. FOMC/CPI inventions are prompt-rejected.
- **Macro context:** Claude may only reference Asset Comparisons, 90-day correlations, and the CALENDAR FACTS BLOCK. No training-data priors for Fed/M2/rate path.
- **"BTC Today read"** is the user-facing label for `narrative_consensus` (was "Consensus"; renamed because that word implied external aggregation we do not have). Internal field names unchanged.
- **Email editor's note** fires on fallback days AND when any enrichment section returned empty/unsourced, listing what was withheld.

## Deployment
See [docs/deployment.md](docs/deployment.md). Production TODOs: env vars in Vercel; Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_MONTHLY_URL`, `NEXT_PUBLIC_STRIPE_ANNUAL_URL`); webhook URL in Stripe dashboard → `https://btctoday.co/api/webhooks/stripe`.
