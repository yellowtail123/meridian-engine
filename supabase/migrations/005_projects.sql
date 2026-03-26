-- ═══════════════════════════════════════════════════════════════════
-- MERIDIAN ENGINE — Research Projects System
-- Migration 005: Tables, RLS, triggers, data migration
-- ═══════════════════════════════════════════════════════════════════

-- ═══ PROJECTS TABLE ═══
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT 'amber',
  icon text DEFAULT '📁',
  is_default boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_active_tab text DEFAULT 'home',
  settings jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

-- ═══ PROJECT MEMBERS (collaboration) ═══
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);

-- ═══ PROJECT-PAPER JUNCTION (many-to-many) ═══
CREATE TABLE IF NOT EXISTS public.project_papers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  paper_id text NOT NULL,
  added_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users(id),
  UNIQUE(project_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_project_papers_project ON public.project_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_papers_paper ON public.project_papers(paper_id);

-- ═══ PROJECT-SPECIES (focus species per project) ═══
CREATE TABLE IF NOT EXISTS public.project_species (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  scientific_name text NOT NULL,
  common_name text,
  speccode integer,
  source text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, scientific_name)
);

CREATE INDEX IF NOT EXISTS idx_project_species_project ON public.project_species(project_id);

-- ═══ PROJECT SEARCH HISTORY ═══
CREATE TABLE IF NOT EXISTS public.project_searches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  query text NOT NULL,
  engines text[],
  result_count integer,
  filters jsonb,
  searched_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_searches_project ON public.project_searches(project_id);

-- ═══ PROJECT AI CONVERSATIONS ═══
CREATE TABLE IF NOT EXISTS public.project_ai_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  model text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_ai_chats_project ON public.project_ai_chats(project_id);

-- ═══ PROJECT ACTIVITY LOG ═══
CREATE TABLE IF NOT EXISTS public.project_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project ON public.project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_created ON public.project_activity(created_at DESC);

-- ═══ ADD project_id TO map_annotations ═══
ALTER TABLE public.map_annotations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- ── PROJECTS ──
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own projects" ON public.projects FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users see shared projects" ON public.projects FOR SELECT
  USING (id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

CREATE POLICY "Users create own projects" ON public.projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins update projects" ON public.projects FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only owners delete projects" ON public.projects FOR DELETE
  USING (owner_id = auth.uid());

-- ── PROJECT MEMBERS ──
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project members" ON public.project_members FOR SELECT
  USING (
    project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR project_id IN (SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid())
  );

CREATE POLICY "Owners and admins manage members" ON public.project_members FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR project_id IN (SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'admin')
  );

CREATE POLICY "Owners and admins update members" ON public.project_members FOR UPDATE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR project_id IN (SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'admin')
  );

CREATE POLICY "Owners and admins remove members" ON public.project_members FOR DELETE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR project_id IN (SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'admin')
  );

-- ── PROJECT PAPERS ──
ALTER TABLE public.project_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project papers" ON public.project_papers FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

CREATE POLICY "Editors add project papers" ON public.project_papers FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors remove project papers" ON public.project_papers FOR DELETE
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'admin')
  ));

-- ── PROJECT SPECIES ──
ALTER TABLE public.project_species ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project species" ON public.project_species FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

CREATE POLICY "Editors manage project species" ON public.project_species FOR ALL
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'admin')
  ));

-- ── PROJECT SEARCHES ──
ALTER TABLE public.project_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project searches" ON public.project_searches FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

CREATE POLICY "Editors log searches" ON public.project_searches FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'admin')
  ));

-- ── PROJECT AI CHATS ──
ALTER TABLE public.project_ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project chats" ON public.project_ai_chats FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

CREATE POLICY "Editors manage chats" ON public.project_ai_chats FOR ALL
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'admin')
  ));

-- ── PROJECT ACTIVITY ──
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project activity" ON public.project_activity FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

CREATE POLICY "Members log activity" ON public.project_activity FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════════════
-- AUTO-CREATE DEFAULT PROJECT FOR NEW USERS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_default_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (owner_id, name, description, is_default, icon, color)
  VALUES (NEW.id, 'General', 'Default project for general research', true, '🔬', 'amber');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_project ON auth.users;
CREATE TRIGGER on_auth_user_created_project
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_project();

-- ═══════════════════════════════════════════════════════════════════
-- AUTO-UPDATE updated_at TIMESTAMP
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER project_ai_chats_updated_at
  BEFORE UPDATE ON public.project_ai_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- DATA MIGRATION — existing users get a General project
-- ═══════════════════════════════════════════════════════════════════

-- Create General projects for all existing users who don't have one
INSERT INTO public.projects (owner_id, name, description, is_default, icon, color)
SELECT id, 'General', 'Default project for general research', true, '🔬', 'amber'
FROM auth.users
WHERE id NOT IN (SELECT owner_id FROM public.projects WHERE is_default = true)
ON CONFLICT DO NOTHING;

-- Assign existing map_annotations to each user's General project
UPDATE public.map_annotations ma
SET project_id = (
  SELECT p.id FROM public.projects p
  WHERE p.owner_id = ma.user_id AND p.is_default = true
  LIMIT 1
)
WHERE ma.project_id IS NULL;

-- Migrate existing library_papers project associations to project_papers junction
-- For each paper with a project name, link it to the matching project (or General)
INSERT INTO public.project_papers (project_id, paper_id, added_by)
SELECT
  COALESCE(
    (SELECT p.id FROM public.projects p WHERE p.owner_id = lp.user_id AND p.name = COALESCE(lp.project, 'Default') LIMIT 1),
    (SELECT p.id FROM public.projects p WHERE p.owner_id = lp.user_id AND p.is_default = true LIMIT 1)
  ),
  lp.local_id,
  lp.user_id
FROM public.library_papers lp
WHERE lp.user_id IS NOT NULL
  AND lp.local_id IS NOT NULL
  AND COALESCE(
    (SELECT p.id FROM public.projects p WHERE p.owner_id = lp.user_id AND p.name = COALESCE(lp.project, 'Default') LIMIT 1),
    (SELECT p.id FROM public.projects p WHERE p.owner_id = lp.user_id AND p.is_default = true LIMIT 1)
  ) IS NOT NULL
ON CONFLICT (project_id, paper_id) DO NOTHING;
