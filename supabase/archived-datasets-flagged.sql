-- Migration: Add 'flagged' status to archived_datasets
-- Run in Supabase SQL Editor after publications-schema.sql

-- Drop and recreate the status check constraint to include 'flagged'
alter table archived_datasets drop constraint if exists archived_datasets_status_check;
alter table archived_datasets add constraint archived_datasets_status_check
  check (status in ('published', 'draft', 'flagged', 'removed'));

-- Dataset flags table (mirrors publication_flags pattern)
create table if not exists dataset_flags (
  id uuid default gen_random_uuid() primary key,
  dataset_id uuid references archived_datasets on delete cascade not null,
  user_id uuid references auth.users not null,
  reason text not null check (reason in (
    'inaccurate', 'incomplete', 'duplicate', 'spam', 'other'
  )),
  description text,
  created_at timestamptz not null default now()
);

alter table dataset_flags enable row level security;

create policy "Users can read own flags; admins read all"
  on dataset_flags for select
  using (auth.uid() = user_id or is_admin());

create policy "Authenticated users can flag datasets"
  on dataset_flags for insert
  with check (auth.uid() = user_id);

create policy "Admins can delete dataset flags"
  on dataset_flags for delete
  using (is_admin());

create index if not exists idx_dataset_flags_dataset on dataset_flags(dataset_id);
