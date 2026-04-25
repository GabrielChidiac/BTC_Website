# src/trigger/publishers/CLAUDE.md

Scoped guidance for publishers. See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for pipeline orchestration.

## Scope
DB persistence + distribution. Run **sequentially** at the end of the pipeline. If save fails, downstream sends are skipped.

## Files
- [save-briefing.ts](save-briefing.ts) — Postgres write. Upserts the BriefingJSON into `daily_briefings` and persists `looking_ahead_predictions` into the `predictions` table (try/catch wrapped; failure does not block briefing save).
- [revalidate-site.ts](revalidate-site.ts) — Triggers Next.js ISR revalidation for the homepage and the new archive date.
- [send-digest.ts](send-digest.ts) — Resend daily email. Batches in chunks of 100 (Resend per-call limit). Uses `%%UNSUBSCRIBE_URL%%` placeholder, replaced per-subscriber with a magic-token sign-in URL.
- [send-weekly-recap.ts](send-weekly-recap.ts) — Sunday 09:00 UTC cron, **free tier only**. Date range: Saturday back 6 days (previous Sunday → Saturday) to skip Sunday's missing briefing. **Load-bearing.**
- [resolve-predictions.ts](resolve-predictions.ts) — Separate cron at 03:00 UTC (2h after pipeline). Auto-scores due predictions: BTC-price metrics via CoinGecko historical close with ±2% flat band; other metrics marked `inconclusive` with a reason. **Load-bearing.**

## Conventions
- Sequential order is intentional: `save → revalidate → send`. Never parallelize.
- Email contact: `hello@btctoday.co`.
- Welcome flow: `welcome.tsx` links to `/sign-in` (no token at subscribe time).
- Daily-digest + weekly-recap use the `%%UNSUBSCRIBE_URL%%` placeholder.
- All public-route email links share the same per-subscriber magic-link token format.

## Anti-patterns
- No retries that bypass the `save → send` ordering. If save fails, the email loop must not fire.
- No fan-out emails outside `chunks of 100` — Resend rejects larger batches.
- Never inline render PDFs in publisher tasks; `/pdf/[date]` is a Next.js page route, not a Trigger task.
