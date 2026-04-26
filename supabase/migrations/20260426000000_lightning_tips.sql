-- ─── Lightning tips ─────────────────────────────────────────────────────────
--
-- Tracks Lightning Network tips received via the CoinOS provider.
-- Each row represents one invoice generated for a tipper. Invoices may or
-- may not be paid; we mark `paid=true` once polling confirms settlement.
-- briefing_date is optional context (which day's brief inspired the tip)
-- and intentionally has NO foreign key so tips can reference past or
-- future dates without coupling to the daily_briefings table lifecycle.

create table if not exists lightning_tips (
  id            uuid        primary key default gen_random_uuid(),
  payment_hash  text        unique not null,
  bolt11        text        not null,
  amount_sats   integer     not null check (amount_sats > 0),
  message       text,
  briefing_date date,
  source        text        not null default 'site'
                            check (source in ('site', 'newsletter', 'archive', 'footer')),
  paid          boolean     not null default false,
  paid_at       timestamptz,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_lightning_tips_paid
  on lightning_tips (paid)
  where paid = true;

create index if not exists idx_lightning_tips_briefing_date
  on lightning_tips (briefing_date)
  where briefing_date is not null;

create index if not exists idx_lightning_tips_created_at
  on lightning_tips (created_at desc);

alter table lightning_tips enable row level security;

create policy "Service role insert lightning_tips"
  on lightning_tips for insert
  to service_role
  with check (true);

create policy "Service role read lightning_tips"
  on lightning_tips for select
  to service_role
  using (true);

create policy "Service role update lightning_tips"
  on lightning_tips for update
  to service_role
  using (true)
  with check (true);
