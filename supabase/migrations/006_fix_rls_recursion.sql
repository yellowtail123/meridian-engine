-- ═══════════════════════════════════════════════════════════════════
-- MERIDIAN ENGINE — Fix RLS infinite recursion
-- Migration 006: projects ↔ project_members policies reference each
-- other, causing "infinite recursion detected in policy" on INSERT/SELECT.
-- Fix: SECURITY DEFINER helpers that bypass RLS for cross-table checks.
-- ═══════════════════════════════════════════════════════════════════

-- ── Helper functions (SECURITY DEFINER = bypass RLS) ──

CREATE OR REPLACE FUNCTION public.user_owned_project_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM projects WHERE owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_member_project_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT project_id FROM project_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_editable_project_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM projects WHERE owner_id = auth.uid()
  UNION
  SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND role IN ('editor', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.user_admin_project_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM projects WHERE owner_id = auth.uid()
  UNION
  SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND role = 'admin';
$$;

-- ═══ Fix PROJECTS policies ═══

DROP POLICY IF EXISTS "Users see shared projects" ON public.projects;
CREATE POLICY "Users see shared projects" ON public.projects FOR SELECT
  USING (id IN (SELECT user_member_project_ids()));

-- ═══ Fix PROJECT_MEMBERS policies ═══

DROP POLICY IF EXISTS "Members see project members" ON public.project_members;
CREATE POLICY "Members see project members" ON public.project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR project_id IN (SELECT user_owned_project_ids())
  );

DROP POLICY IF EXISTS "Owners and admins manage members" ON public.project_members;
CREATE POLICY "Owners and admins manage members" ON public.project_members FOR INSERT
  WITH CHECK (project_id IN (SELECT user_admin_project_ids()));

DROP POLICY IF EXISTS "Owners and admins update members" ON public.project_members;
CREATE POLICY "Owners and admins update members" ON public.project_members FOR UPDATE
  USING (project_id IN (SELECT user_admin_project_ids()));

DROP POLICY IF EXISTS "Owners and admins remove members" ON public.project_members;
CREATE POLICY "Owners and admins remove members" ON public.project_members FOR DELETE
  USING (project_id IN (SELECT user_admin_project_ids()));

-- ═══ Fix PROJECT_PAPERS policies ═══

DROP POLICY IF EXISTS "Members see project papers" ON public.project_papers;
CREATE POLICY "Members see project papers" ON public.project_papers FOR SELECT
  USING (project_id IN (SELECT user_owned_project_ids())
      OR project_id IN (SELECT user_member_project_ids()));

DROP POLICY IF EXISTS "Editors add project papers" ON public.project_papers;
CREATE POLICY "Editors add project papers" ON public.project_papers FOR INSERT
  WITH CHECK (project_id IN (SELECT user_editable_project_ids()));

DROP POLICY IF EXISTS "Editors remove project papers" ON public.project_papers;
CREATE POLICY "Editors remove project papers" ON public.project_papers FOR DELETE
  USING (project_id IN (SELECT user_editable_project_ids()));

-- ═══ Fix PROJECT_SPECIES policies ═══

DROP POLICY IF EXISTS "Members see project species" ON public.project_species;
CREATE POLICY "Members see project species" ON public.project_species FOR SELECT
  USING (project_id IN (SELECT user_owned_project_ids())
      OR project_id IN (SELECT user_member_project_ids()));

DROP POLICY IF EXISTS "Editors manage project species" ON public.project_species;
CREATE POLICY "Editors manage project species" ON public.project_species FOR ALL
  USING (project_id IN (SELECT user_editable_project_ids()));

-- ═══ Fix PROJECT_SEARCHES policies ═══

DROP POLICY IF EXISTS "Members see project searches" ON public.project_searches;
CREATE POLICY "Members see project searches" ON public.project_searches FOR SELECT
  USING (project_id IN (SELECT user_owned_project_ids())
      OR project_id IN (SELECT user_member_project_ids()));

DROP POLICY IF EXISTS "Editors log searches" ON public.project_searches;
CREATE POLICY "Editors log searches" ON public.project_searches FOR INSERT
  WITH CHECK (project_id IN (SELECT user_editable_project_ids()));

-- ═══ Fix PROJECT_AI_CHATS policies ═══

DROP POLICY IF EXISTS "Members see project chats" ON public.project_ai_chats;
CREATE POLICY "Members see project chats" ON public.project_ai_chats FOR SELECT
  USING (project_id IN (SELECT user_owned_project_ids())
      OR project_id IN (SELECT user_member_project_ids()));

DROP POLICY IF EXISTS "Editors manage chats" ON public.project_ai_chats;
CREATE POLICY "Editors manage chats" ON public.project_ai_chats FOR ALL
  USING (project_id IN (SELECT user_editable_project_ids()));

-- ═══ Fix PROJECT_ACTIVITY policies ═══

DROP POLICY IF EXISTS "Members see project activity" ON public.project_activity;
CREATE POLICY "Members see project activity" ON public.project_activity FOR SELECT
  USING (project_id IN (SELECT user_owned_project_ids())
      OR project_id IN (SELECT user_member_project_ids()));

DROP POLICY IF EXISTS "Members log activity" ON public.project_activity;
CREATE POLICY "Members log activity" ON public.project_activity FOR INSERT
  WITH CHECK (project_id IN (SELECT user_owned_project_ids())
           OR project_id IN (SELECT user_member_project_ids()));
