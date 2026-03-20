-- Meridian Engine — Admin Schema
-- Run this in the Supabase SQL Editor AFTER running schema.sql

-- ═══ USER ROLES TABLE ═══

create table user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users unique not null,
  role text default 'user' not null,
  created_at timestamptz default now()
);

create index idx_user_roles_user on user_roles(user_id);

alter table user_roles enable row level security;

-- Users can read their own role
create policy "Users can read own role" on user_roles
  for select using (auth.uid() = user_id);

-- Admins can read all roles
create policy "Admins can read all roles" on user_roles
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admins can insert roles
create policy "Admins can insert roles" on user_roles
  for insert with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admins can update roles
create policy "Admins can update roles" on user_roles
  for update using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admins can delete roles
create policy "Admins can delete roles" on user_roles
  for delete using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ═══ ADMIN FUNCTIONS ═══
-- These use SECURITY DEFINER to access auth.users (runs as table owner)

-- List all users with their roles
create or replace function admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  is_banned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(r.role, 'user') as role,
    coalesce(u.banned_until > now(), false) as is_banned
  from auth.users u
  left join user_roles r on r.user_id = u.id
  order by u.created_at desc;
end;
$$;

-- Get aggregate usage stats
create or replace function admin_get_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'total_papers', (select count(*) from library_papers),
    'total_workshop', (select count(*) from workshop_data),
    'total_analyses', (select count(*) from analysis_results),
    'users_today', (select count(*) from auth.users where created_at::date = current_date),
    'users_this_week', (select count(*) from auth.users where created_at >= current_date - interval '7 days'),
    'papers_this_week', (select count(*) from library_papers where saved_at >= current_date - interval '7 days')
  ) into result;

  return result;
end;
$$;

-- Ban or unban a user
create or replace function admin_set_user_banned(target_user_id uuid, ban boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- Don't allow banning yourself
  if target_user_id = auth.uid() then
    raise exception 'Cannot ban yourself';
  end if;

  if ban then
    update auth.users set banned_until = '2099-12-31T23:59:59Z'::timestamptz where id = target_user_id;
  else
    update auth.users set banned_until = null where id = target_user_id;
  end if;
end;
$$;

-- ═══ BOOTSTRAP ═══
-- After running this SQL, manually insert your own user as admin:
--
--   insert into user_roles (user_id, role)
--   values ('<YOUR-USER-UUID-FROM-AUTH.USERS>', 'admin');
--
-- Find your UUID: select id, email from auth.users;
