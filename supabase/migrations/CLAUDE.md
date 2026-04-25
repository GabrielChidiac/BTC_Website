# supabase/migrations/CLAUDE.md

Scoped guidance for Postgres migrations. See [/CLAUDE.md](/CLAUDE.md) for global rules.

## Scope
SQL migrations applied via Supabase. **Append-only**: never edit a migration after it has been applied to any environment.

## Naming
`YYYYMMDDhhmmss_description.sql` — timestamp prefix + snake_case description. The timestamp determines apply order.

## Tables in current schema
- `daily_briefings` — date PK + JSONB `content` (BriefingJSON). Public read via RLS.
- `subscribers` — email, tier (`'free' | 'pro'`), status (`'active' | 'unsubscribed' | 'pending'`), `is_founding_member`, Stripe IDs. Service-role only.
- `verification_codes` — magic-link tokens AND session tokens (sessions stored as `session:<uuid>` in `code`). Service-role only.
- `predictions` — silent data collection for the day-60 accuracy scorecard. Auto-resolved by `resolve-predictions` cron. Service-role only.
- `rate_limits` — IP-bucketed counters. Used by `src/lib/rate-limit.ts` (fail-open). Service-role only.

## RLS posture
- `daily_briefings`: public SELECT.
- All others: **service-role only**. The website reads them via `createServiceClient()` in API route handlers, never via the browser.

## Conventions
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotency.
- Prefer `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` over `ADD COLUMN` for forward-compatibility.
- New tables: enable RLS by default with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and add explicit policies.
- Postgres RPCs (e.g., `increment_rate_limit`) live in migrations alongside the table they support.

## Anti-patterns
- No editing applied migrations. If a change is needed, write a new migration.
- No DROP TABLE without a backup plan and a separate, intentionally-named migration.
- No DOWN migrations — Supabase's flow is forward-only.
- No raw connection strings in migrations; all auth happens through Supabase env vars.
