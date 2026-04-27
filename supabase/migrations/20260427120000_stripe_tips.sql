-- ─── Stripe tips ────────────────────────────────────────────────────────────
--
-- Tracks one-time card tips collected via Stripe Checkout (mode='payment').
-- Mirrors lightning_tips structure where it makes sense; uses USD cents
-- (Stripe's native unit) instead of sats. We don't track on-chain BTC tips
-- at all -- those are fire-and-forget against a static address advertised
-- on /tip.
--
-- Lifecycle:
--   1. /api/tips/stripe-checkout inserts a row with paid=false and a
--      generated UUID, then creates a Checkout Session with
--      payment_intent_data.metadata.tip_id = <row.id> for webhook reconciliation.
--   2. User completes payment on Stripe.
--   3. Webhook (mode='payment' branch) updates paid=true by tip_id metadata
--      lookup, falling back to stripe_session_id.
--   4. /tip/thanks reads by stripe_session_id to confirm to the user.
--
-- briefing_date is optional context (which day's brief inspired the tip)
-- and intentionally has NO foreign key so tips can reference past or
-- future dates without coupling to the daily_briefings table lifecycle.

create table if not exists stripe_tips (
  id                          uuid        primary key default gen_random_uuid(),
  stripe_session_id           text        unique,
  stripe_payment_intent_id    text        unique,
  amount_cents                integer     not null check (amount_cents >= 100),
  currency                    text        not null default 'usd',
  tipper_name                 text,
  tipper_email                text,
  message                     text,
  briefing_date               date,
  source                      text        not null default 'site'
                                          check (source in ('site', 'newsletter', 'archive', 'footer')),
  paid                        boolean     not null default false,
  paid_at                     timestamptz,
  created_at                  timestamptz not null default now()
);

create index if not exists idx_stripe_tips_paid
  on stripe_tips (paid)
  where paid = true;

create index if not exists idx_stripe_tips_session_id
  on stripe_tips (stripe_session_id);

create index if not exists idx_stripe_tips_briefing_date
  on stripe_tips (briefing_date)
  where briefing_date is not null;

create index if not exists idx_stripe_tips_created_at
  on stripe_tips (created_at desc);

alter table stripe_tips enable row level security;

create policy "Service role insert stripe_tips"
  on stripe_tips for insert
  to service_role
  with check (true);

create policy "Service role read stripe_tips"
  on stripe_tips for select
  to service_role
  using (true);

create policy "Service role update stripe_tips"
  on stripe_tips for update
  to service_role
  using (true)
  with check (true);
