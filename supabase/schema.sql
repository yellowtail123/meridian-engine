-- Meridian Engine — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ═══ TABLES ═══

create table library_papers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text,
  authors text,
  abstract text,
  doi text,
  source text,
  year int,
  journal text,
  concepts text[],
  tags text[],
  notes text,
  findings jsonb,
  project text default 'Default',
  local_id text,
  saved_at timestamptz default now()
);

create table environmental_presets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text,
  lat float,
  lon float,
  variables jsonb,
  date_range jsonb,
  created_at timestamptz default now()
);

create table workshop_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text,
  data_json jsonb,
  created_at timestamptz default now()
);

create table analysis_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text,
  type text,
  result_json jsonb,
  created_at timestamptz default now()
);

create table user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users unique not null,
  ai_provider text,
  ai_model text,
  theme text,
  preferences_json jsonb
);

-- ═══ INDEXES ═══

create index idx_library_papers_user on library_papers(user_id);
create index idx_library_papers_doi on library_papers(user_id, doi);
create index idx_environmental_presets_user on environmental_presets(user_id);
create index idx_workshop_data_user on workshop_data(user_id);
create index idx_analysis_results_user on analysis_results(user_id);
create index idx_user_settings_user on user_settings(user_id);

-- ═══ ROW LEVEL SECURITY ═══

alter table library_papers enable row level security;
alter table environmental_presets enable row level security;
alter table workshop_data enable row level security;
alter table analysis_results enable row level security;
alter table user_settings enable row level security;

-- library_papers policies
create policy "Users can select own papers" on library_papers
  for select using (auth.uid() = user_id);
create policy "Users can insert own papers" on library_papers
  for insert with check (auth.uid() = user_id);
create policy "Users can update own papers" on library_papers
  for update using (auth.uid() = user_id);
create policy "Users can delete own papers" on library_papers
  for delete using (auth.uid() = user_id);

-- environmental_presets policies
create policy "Users can select own presets" on environmental_presets
  for select using (auth.uid() = user_id);
create policy "Users can insert own presets" on environmental_presets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own presets" on environmental_presets
  for update using (auth.uid() = user_id);
create policy "Users can delete own presets" on environmental_presets
  for delete using (auth.uid() = user_id);

-- workshop_data policies
create policy "Users can select own workshop data" on workshop_data
  for select using (auth.uid() = user_id);
create policy "Users can insert own workshop data" on workshop_data
  for insert with check (auth.uid() = user_id);
create policy "Users can update own workshop data" on workshop_data
  for update using (auth.uid() = user_id);
create policy "Users can delete own workshop data" on workshop_data
  for delete using (auth.uid() = user_id);

-- analysis_results policies
create policy "Users can select own results" on analysis_results
  for select using (auth.uid() = user_id);
create policy "Users can insert own results" on analysis_results
  for insert with check (auth.uid() = user_id);
create policy "Users can update own results" on analysis_results
  for update using (auth.uid() = user_id);
create policy "Users can delete own results" on analysis_results
  for delete using (auth.uid() = user_id);

-- user_settings policies
create policy "Users can select own settings" on user_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);
create policy "Users can delete own settings" on user_settings
  for delete using (auth.uid() = user_id);
