-- Run this in the Supabase SQL Editor to verify and fix admin role access.
-- This ensures the user_roles table exists, RLS is enabled, and the
-- "Users can read own role" policy is in place.

-- 1. Ensure table exists
create table if not exists user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users unique not null,
  role text default 'user' not null,
  created_at timestamptz default now()
);

-- 2. Ensure RLS is enabled
alter table user_roles enable row level security;

-- 3. Drop and recreate the "Users can read own role" policy to be safe
drop policy if exists "Users can read own role" on user_roles;
create policy "Users can read own role" on user_roles
  for select using (auth.uid() = user_id);

-- 4. Verify your admin row exists (update the email below)
-- select ur.*, u.email from user_roles ur join auth.users u on u.id = ur.user_id;

-- 5. If you don't see your row, insert it:
-- insert into user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict (user_id) do update set role = 'admin';
