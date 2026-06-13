# src/lib/CLAUDE.md

Scoped guidance for shared library code. See [/CLAUDE.md](/CLAUDE.md) for global rules.

## Scope
Code shared between the Trigger.dev pipeline and the Next.js website. Edits here propagate to both surfaces; verify both compile.

## Type & schema source of truth
- [types.ts](types.ts) — `BriefingJSON` master type. **Keep in sync with [schemas.ts](schemas.ts).**
- [schemas.ts](schemas.ts) — zod schemas for every Claude output (`SynthesizerOutputSchema`, `AnalysisBlockSchema`, `ExpertInsightsArraySchema`, etc.). Used by `callClaudeJSON` for runtime validation.
- Adding a field: update both files in the same change; `npm run build` catches drift.

## Reader-visible utilities
- [utils.ts](utils.ts) — `computeReadTimeSeconds(briefing)` (200 WPM, hardcoded; **silent — no longer displayed since 2026-04-28**), `formatReadTime(seconds)`, `halvingProgress`, `flowMoveText/Url`.
- [dedupe-stories.ts](dedupe-stories.ts) — `dedupeBriefingStories` removes near-duplicate items across `top_stories + regulatory + adoption`. Run by the Synthesizer post-generation.

## Subscription / auth
- [tier.ts](tier.ts) — `getSubscriberTier()` reads session cookie → checks tier. Used by Server Components.
- [session.ts](session.ts) — `COOKIE_NAME = "btc-session"`, `setSessionCookie()`, `clearSessionCookie()`. **Always import from here**, never construct cookies inline.
- [stripe.ts](stripe.ts) — `verifyStripeWebhook()` validates Stripe signatures.
- [founding.ts](founding.ts) — `getFoundingMemberStatus()` checks `is_founding_member` and `FOUNDING_MEMBER_LIMIT`.
- [constants.ts](constants.ts) — `FOUNDING_MEMBER_LIMIT` and other compile-time constants.
- [url.ts](url.ts) — `getBaseUrl()` resolves the site URL; never falls back to localhost.

## Inputs / safety
- [rate-limit.ts](rate-limit.ts) — `checkRateLimit()`, `getClientIp()`. **Fail-open** on errors; HMAC/auth is the second layer.
- [validation.ts](validation.ts) — input validators for API routes.

## Reference data
- [experts-data.ts](experts-data.ts), [expert-photos.ts](expert-photos.ts) — `getExpertPhotoUrls(name, twitter_handle)` for the Expert Insights UI.
- [json-ld.ts](json-ld.ts) — structured-data helpers for SEO.

## Subdirectory
- [supabase/](supabase/) — Supabase client constructors. See its CLAUDE.md.

## Conventions
- Always `.maybeSingle()` on Supabase reads; never `.single()` (throws on 0 rows).
- Import the SSR helpers from `@/lib/supabase/...`, not directly from `@supabase/supabase-js`.
- TypeScript strict; no `any` without an explicit narrowing comment.

## Anti-patterns
- No `tailwind.config.js` — Tailwind v4 is configured in `globals.css`.
- No raw `@supabase/supabase-js` imports.
- No `.single()` on Supabase queries.
