-- ─── Daily Briefings ────────────────────────────────────────────────────────

create table if not exists daily_briefings (
  date       date        primary key,
  content    jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on daily_briefings
  for each row
  execute function update_updated_at();

-- ─── Subscribers ────────────────────────────────────────────────────────────

create table if not exists subscribers (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  status     text        not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscribers_email on subscribers (email);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table daily_briefings enable row level security;
alter table subscribers enable row level security;

-- Public can read briefings (anonymous + authenticated)
create policy "Public read briefings"
  on daily_briefings for select
  to anon, authenticated
  using (true);

-- Only service role can insert/update briefings (pipeline writes)
create policy "Service role write briefings"
  on daily_briefings for insert
  to service_role
  with check (true);

create policy "Service role update briefings"
  on daily_briefings for update
  to service_role
  using (true)
  with check (true);

-- Only service role can manage subscribers
create policy "Service role insert subscribers"
  on subscribers for insert
  to service_role
  with check (true);

create policy "Service role update subscribers"
  on subscribers for update
  to service_role
  using (true)
  with check (true);

create policy "Service role read subscribers"
  on subscribers for select
  to service_role
  using (true);
