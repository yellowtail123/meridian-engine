-- ═══ User Profiles table ═══
-- Stores display name, affiliation, ORCID, notification prefs
-- Referenced by meridian-ui.js (initHome, loadProfileSettings, saveProfile, exportMyData, deleteAccount)

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  affiliation text,
  orcid text,
  notify_comments boolean DEFAULT true,
  notify_flags boolean DEFAULT true,
  public_profile boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- RLS: users can only read/write their own profile
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Allow public read of display_name for community features (e.g. publication comments)
CREATE POLICY "Public profiles are readable"
  ON public.user_profiles FOR SELECT
  USING (public_profile = true);
