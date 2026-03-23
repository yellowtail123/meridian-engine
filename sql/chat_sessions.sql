-- Meridian AI: Chat Sessions (Bookmarked Conversations)
-- Run this in the Supabase SQL Editor for your project.

create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled conversation',
  provider    text,
  model       text,
  messages    jsonb not null default '[]'::jsonb,
  bookmarked  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists idx_chat_sessions_user
  on public.chat_sessions(user_id, bookmarked, updated_at desc);

-- Auto-update updated_at on row change
create or replace function public.handle_chat_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.handle_chat_sessions_updated_at();

-- Row Level Security
alter table public.chat_sessions enable row level security;

-- Users can only see/modify their own conversations
create policy "Users manage own chat sessions"
  on public.chat_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
