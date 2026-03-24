-- ═══ Map Annotations table ═══
-- Stores user-pinned environmental data annotations on the map

CREATE TABLE IF NOT EXISTS map_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  tags text[],
  color text DEFAULT 'amber',
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  date_range_start timestamptz,
  date_range_end timestamptz,
  variable_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_map_annotations_user_id ON map_annotations(user_id);

-- RLS: users can only read/write their own annotations
ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own annotations"
  ON map_annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annotations"
  ON map_annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
  ON map_annotations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
  ON map_annotations FOR DELETE
  USING (auth.uid() = user_id);
