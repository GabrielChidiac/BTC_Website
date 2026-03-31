-- Chat rate limiting table (replaces in-memory rate limiter for serverless)
create table if not exists chat_rate_limits (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by email + time window
create index idx_chat_rate_limits_email_time on chat_rate_limits (email, created_at desc);

-- RLS: service role only (API route uses service client)
alter table chat_rate_limits enable row level security;

-- Auto-cleanup: delete entries older than 15 minutes to prevent table bloat
-- Run via pg_cron or Supabase scheduled function
create or replace function cleanup_chat_rate_limits() returns void as $$
  delete from chat_rate_limits where created_at < now() - interval '15 minutes';
$$ language sql;
