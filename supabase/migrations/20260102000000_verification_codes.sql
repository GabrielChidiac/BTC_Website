-- ─── Verification Codes (OTP for chat access) ────────────────────────────────

create table if not exists verification_codes (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  code       text        not null,
  expires_at timestamptz not null,
  used       boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_codes_email on verification_codes (email);
create index if not exists idx_verification_codes_expires on verification_codes (expires_at);

-- RLS: only service role can manage verification codes
alter table verification_codes enable row level security;

create policy "Service role manage verification_codes"
  on verification_codes for all
  to service_role
  using (true)
  with check (true);

-- Clean up expired codes periodically (optional: call via cron or pg_cron)
-- delete from verification_codes where expires_at < now() - interval '1 day';
