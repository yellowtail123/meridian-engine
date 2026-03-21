-- Meridian Engine — Admin Schema
-- Run this in the Supabase SQL Editor AFTER running schema.sql

-- ═══ USER ROLES TABLE ═══

create table if not exists user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users unique not null,
  role text default 'user' not null,
  created_at timestamptz default now()
);

create index if not exists idx_user_roles_user on user_roles(user_id);

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

-- ═══ ADMIN LOGS TABLE ═══

create table if not exists admin_logs (
  id uuid default gen_random_uuid() primary key,
  admin_user_id uuid references auth.users not null,
  action text not null,
  target_user_id uuid references auth.users,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_admin_logs_admin on admin_logs(admin_user_id);
create index if not exists idx_admin_logs_created on admin_logs(created_at desc);

alter table admin_logs enable row level security;

-- Only admins can read logs
create policy "Admins can read logs" on admin_logs
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Only admins can insert logs
create policy "Admins can insert logs" on admin_logs
  for insert with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ═══ HELPER: is_admin() ═══

create or replace function is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
end;
$$;

-- ═══ ADMIN RLS: let admins read all user data ═══

-- library_papers
create policy "Admins can read all papers" on library_papers
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- environmental_presets
create policy "Admins can read all presets" on environmental_presets
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- workshop_data
create policy "Admins can read all workshop data" on workshop_data
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- analysis_results
create policy "Admins can read all results" on analysis_results
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- user_settings
create policy "Admins can read all settings" on user_settings
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ═══ ADMIN FUNCTIONS ═══
-- These use SECURITY DEFINER to access auth.users (runs as table owner)

-- List all users with roles, provider, and data counts
create or replace function admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  is_banned boolean,
  provider text,
  papers_count bigint,
  presets_count bigint,
  workshop_count bigint,
  analyses_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(r.role, 'user') as role,
    coalesce(u.banned_until > now(), false) as is_banned,
    coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
    (select count(*) from library_papers lp where lp.user_id = u.id) as papers_count,
    (select count(*) from environmental_presets ep where ep.user_id = u.id) as presets_count,
    (select count(*) from workshop_data wd where wd.user_id = u.id) as workshop_count,
    (select count(*) from analysis_results ar where ar.user_id = u.id) as analyses_count
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
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'active_7d', (select count(*) from auth.users where last_sign_in_at >= current_date - interval '7 days'),
    'total_papers', (select count(*) from library_papers),
    'total_presets', (select count(*) from environmental_presets),
    'total_workshop', (select count(*) from workshop_data),
    'total_analyses', (select count(*) from analysis_results),
    'users_today', (select count(*) from auth.users where created_at::date = current_date),
    'users_this_week', (select count(*) from auth.users where created_at >= current_date - interval '7 days'),
    'papers_this_week', (select count(*) from library_papers where saved_at >= current_date - interval '7 days')
  ) into result;

  return result;
end;
$$;

-- Get signup counts by day for the last 30 days
create or replace function admin_signups_over_time()
returns table (day date, signups bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select d::date as day, count(u.id) as signups
  from generate_series(current_date - interval '29 days', current_date, '1 day') d
  left join auth.users u on u.created_at::date = d::date
  group by d::date
  order by d::date;
end;
$$;

-- Ban or unban a user (with logging)
create or replace function admin_set_user_banned(target_user_id uuid, ban boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot ban yourself';
  end if;

  if ban then
    update auth.users set banned_until = '2099-12-31T23:59:59Z'::timestamptz where id = target_user_id;
  else
    update auth.users set banned_until = null where id = target_user_id;
  end if;

  insert into admin_logs (admin_user_id, action, target_user_id, details)
  values (auth.uid(), case when ban then 'ban_user' else 'unban_user' end, target_user_id, null);
end;
$$;

-- Change a user's role (with logging)
create or replace function admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_role text;
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot change your own role';
  end if;

  if new_role not in ('user', 'admin', 'banned') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select coalesce(r.role, 'user') into old_role
  from (select 1) x left join user_roles r on r.user_id = target_user_id;

  -- Upsert role
  insert into user_roles (user_id, role)
  values (target_user_id, new_role)
  on conflict (user_id) do update set role = new_role;

  -- If role is 'banned', also set banned_until
  if new_role = 'banned' then
    update auth.users set banned_until = '2099-12-31T23:59:59Z'::timestamptz where id = target_user_id;
  else
    update auth.users set banned_until = null where id = target_user_id;
  end if;

  insert into admin_logs (admin_user_id, action, target_user_id, details)
  values (auth.uid(), 'change_role', target_user_id, json_build_object('old_role', old_role, 'new_role', new_role)::jsonb);
end;
$$;

-- Delete a user account (with logging)
create or replace function admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot delete yourself';
  end if;

  select email into target_email from auth.users where id = target_user_id;

  -- Log before deletion
  insert into admin_logs (admin_user_id, action, target_user_id, details)
  values (auth.uid(), 'delete_user', target_user_id, json_build_object('email', target_email)::jsonb);

  -- Delete user data
  delete from library_papers where user_id = target_user_id;
  delete from environmental_presets where user_id = target_user_id;
  delete from workshop_data where user_id = target_user_id;
  delete from analysis_results where user_id = target_user_id;
  delete from user_settings where user_id = target_user_id;
  delete from user_roles where user_id = target_user_id;

  -- Delete auth user
  delete from auth.users where id = target_user_id;
end;
$$;

-- Get a specific user's library papers (read-only admin view)
create or replace function admin_get_user_papers(target_user_id uuid)
returns table (
  id uuid,
  title text,
  authors text,
  doi text,
  journal text,
  year int,
  project text,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select lp.id, lp.title, lp.authors, lp.doi, lp.journal, lp.year, lp.project, lp.saved_at
  from library_papers lp
  where lp.user_id = target_user_id
  order by lp.saved_at desc;
end;
$$;

-- Get recent admin logs
create or replace function admin_get_logs(lim int default 50)
returns table (
  id uuid,
  admin_email text,
  action text,
  target_email text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    al.id,
    (select email from auth.users where id = al.admin_user_id)::text as admin_email,
    al.action,
    (select email from auth.users where id = al.target_user_id)::text as target_email,
    al.details,
    al.created_at
  from admin_logs al
  order by al.created_at desc
  limit lim;
end;
$$;

-- ═══ BOOTSTRAP ═══
-- After running this SQL, manually insert your own user as admin:
--
--   insert into user_roles (user_id, role)
--   values ('<YOUR-USER-UUID-FROM-AUTH.USERS>', 'admin');
--
-- Find your UUID: select id, email from auth.users;
