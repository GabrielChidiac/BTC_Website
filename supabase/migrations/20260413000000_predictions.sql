-- ─── Predictions (silent data collection for day-60 scorecard) ─────────────
--
-- Every day the AI brain generates 2-3 forward-looking predictions as part of
-- looking_ahead_predictions on the BriefingJSON. These are stored here for
-- later resolution against actual market data and publication as a trust
-- scorecard once enough resolved data points exist.

create table if not exists predictions (
  id                uuid        primary key default gen_random_uuid(),
  briefing_date     date        not null references daily_briefings(date) on delete cascade,
  claim_text        text        not null,
  direction         text        not null check (direction in ('up', 'down', 'flat')),
  metric            text        not null,
  target_date       date        not null,
  resolution_status text        not null default 'pending'
                                check (resolution_status in ('pending', 'correct', 'incorrect', 'inconclusive')),
  actual_outcome    text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- Index on target_date for the future resolver task
create index if not exists idx_predictions_target_date on predictions (target_date);
create index if not exists idx_predictions_status on predictions (resolution_status);

-- Service-role only: nothing public, nothing user-facing yet
alter table predictions enable row level security;

create policy "Service role insert predictions"
  on predictions for insert
  to service_role
  with check (true);

create policy "Service role read predictions"
  on predictions for select
  to service_role
  using (true);

create policy "Service role update predictions"
  on predictions for update
  to service_role
  using (true)
  with check (true);
