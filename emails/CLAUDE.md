# emails/CLAUDE.md

Scoped guidance for email templates. See [/CLAUDE.md](/CLAUDE.md) for global rules.

## Scope
React Email templates rendered server-side at send time. Each template ships **HTML React render + plain-text fallback**; both must be updated together.

## Files
- [daily-digest.tsx](daily-digest.tsx) — main daily email. Both Pro and Free see it (with tier-aware sections).
- [weekly-recap.tsx](weekly-recap.tsx) — **Free tier only**, sent Sunday 09:00 UTC by `send-weekly-recap`. **Load-bearing** (per the load-bearing-features list).
- [welcome.tsx](welcome.tsx) — subscription confirmation; links to `/sign-in`.
- [founding-welcome.tsx](founding-welcome.tsx) — for `is_founding_member` subscribers. **Load-bearing.**
- [pro-welcome.tsx](pro-welcome.tsx) — for non-founding Pro subscribers.
- [verification.tsx](verification.tsx) — magic-link verification.
- [unsubscribe-confirmation.tsx](unsubscribe-confirmation.tsx) — final unsubscribe receipt.
- [daily-summary-pdf.tsx](daily-summary-pdf.tsx) — **not an email**. Rendered by the `/pdf/[date]` Next.js page route via `@react-pdf/renderer`.

## Hard rules
- **No em dashes (—) anywhere** in user-facing email copy. Use commas, periods, or semicolons. (Per `feedback_no_em_dashes.md`.)
- **Complete-all-paths rule**: when removing or changing copy, check **every path**: HTML, plain-text fallback, weekly recap, daily digest, verification, welcome flows. Per `feedback_email_removal_requests.md` — incomplete removals are a recurring failure mode.
- **Unsubscribe placeholder**: Daily-digest + weekly-recap use `%%UNSUBSCRIBE_URL%%`, replaced per-subscriber by the publisher with a magic-token sign-in URL.
- **Contact email**: `hello@btctoday.co`.
- **Resend per-call cap**: 100 recipients per batch. Publisher chunks accordingly.

## Voice
Write peer-to-peer with a professional adult, not a Crypto Twitter degen. Same voice as the website briefing. Quality over quantity. No hype, no hand-holding.

## Anti-patterns
- No em dashes in user-facing strings.
- No partial removals — touch HTML AND plain-text in the same change.
- No hard-coded localhost URLs; use `getBaseUrl()` from `@/lib/url`.
- No images that aren't already in the existing template's design system; the digest is text-first by design.
