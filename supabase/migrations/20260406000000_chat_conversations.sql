-- Chat conversation persistence for Pro subscribers
create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_conversations_email on chat_conversations(email);

-- Auto-update updated_at
create or replace function update_chat_conversations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chat_conversations_updated_at
  before update on chat_conversations
  for each row execute function update_chat_conversations_updated_at();

-- RLS: service role only (same pattern as other tables)
alter table chat_conversations enable row level security;
