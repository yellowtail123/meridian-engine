-- ═══════════════════════════════════════════════════════════════════
-- MERIDIAN ENGINE — Research Hub + Extended User Profiles
-- Migration 007: ALTER user_profiles, forum tables, RPC, triggers
-- ═══════════════════════════════════════════════════════════════════

-- ═══ EXTEND USER PROFILES ═══
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS affiliation_type text CHECK (affiliation_type IN ('university','government','ngo','private','independent','other')),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS research_interests text[],
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS reputation integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS credential_visibility text DEFAULT 'public' CHECK (credential_visibility IN ('public','members_only','private')),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Allow anyone to read public profiles (needed for forum UserBadge)
DROP POLICY IF EXISTS "Public profiles are readable" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can read public profiles" ON public.user_profiles;
CREATE POLICY "Anyone can read public profiles"
  ON public.user_profiles FOR SELECT USING (true);

-- ═══ FORUM POSTS ═══
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  flair text CHECK (flair IN ('question','discussion','methods_help','data_request','collaboration','field_report','announcement','meta')),
  linked_species text,
  linked_paper_doi text,
  linked_dataset_id uuid,
  linked_coordinates jsonb,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  score integer GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  comment_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  pinned boolean DEFAULT false,
  locked boolean DEFAULT false,
  hidden boolean DEFAULT false,
  flag_count integer DEFAULT 0,
  has_accepted_answer boolean DEFAULT false,
  accepted_answer_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible posts"
  ON public.forum_posts FOR SELECT USING (hidden = false OR author_id = auth.uid());
CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own posts"
  ON public.forum_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own posts"
  ON public.forum_posts FOR DELETE USING (auth.uid() = author_id);
-- Admin can update any post (pin, lock, hide)
CREATE POLICY "Admins can update any post"
  ON public.forum_posts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete any post"
  ON public.forum_posts FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_forum_posts_score ON public.forum_posts (score DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_last_activity ON public.forum_posts (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_flair ON public.forum_posts (flair);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON public.forum_posts (author_id);

-- ═══ FORUM COMMENTS ═══
CREATE TABLE IF NOT EXISTS public.forum_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  score integer GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  is_accepted_answer boolean DEFAULT false,
  hidden boolean DEFAULT false,
  flag_count integer DEFAULT 0,
  edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible comments"
  ON public.forum_comments FOR SELECT USING (hidden = false OR author_id = auth.uid());
CREATE POLICY "Authenticated users can create comments"
  ON public.forum_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own comments"
  ON public.forum_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own comments"
  ON public.forum_comments FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Admins can update any comment"
  ON public.forum_comments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete any comment"
  ON public.forum_comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON public.forum_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent ON public.forum_comments (parent_comment_id);

-- ═══ VOTES ═══
CREATE TABLE IF NOT EXISTS public.forum_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  vote_type smallint NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT one_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_vote UNIQUE (user_id, post_id),
  CONSTRAINT unique_comment_vote UNIQUE (user_id, comment_id)
);

ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own votes" ON public.forum_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can vote" ON public.forum_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change own votes" ON public.forum_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON public.forum_votes FOR DELETE USING (auth.uid() = user_id);

-- ═══ FLAGS ═══
CREATE TABLE IF NOT EXISTS public.forum_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','offensive','misinformation','off_topic','harassment','other')),
  details text,
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_action text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT one_flag_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_flag UNIQUE (reporter_id, post_id),
  CONSTRAINT unique_comment_flag UNIQUE (reporter_id, comment_id)
);

ALTER TABLE public.forum_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create flags" ON public.forum_flags FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can read own flags" ON public.forum_flags FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can read all flags" ON public.forum_flags FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update flags" ON public.forum_flags FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ═══ RPC: VOTE ON POST ═══
CREATE OR REPLACE FUNCTION public.vote_on_post(p_post_id uuid, p_vote_type smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE existing_vote smallint;
BEGIN
  SELECT vote_type INTO existing_vote FROM forum_votes
    WHERE user_id = auth.uid() AND post_id = p_post_id;
  IF existing_vote IS NOT NULL THEN
    IF existing_vote = p_vote_type THEN
      DELETE FROM forum_votes WHERE user_id = auth.uid() AND post_id = p_post_id;
    ELSE
      UPDATE forum_votes SET vote_type = p_vote_type WHERE user_id = auth.uid() AND post_id = p_post_id;
    END IF;
  ELSE
    INSERT INTO forum_votes (user_id, post_id, vote_type) VALUES (auth.uid(), p_post_id, p_vote_type);
  END IF;
  UPDATE forum_posts SET
    upvotes = (SELECT count(*) FROM forum_votes WHERE post_id = p_post_id AND vote_type = 1),
    downvotes = (SELECT count(*) FROM forum_votes WHERE post_id = p_post_id AND vote_type = -1)
  WHERE id = p_post_id;
  UPDATE user_profiles SET reputation = (
    SELECT COALESCE(SUM(CASE WHEN fv.vote_type=1 THEN 10 WHEN fv.vote_type=-1 THEN -2 ELSE 0 END),0)
    FROM forum_votes fv JOIN forum_posts fp ON fv.post_id=fp.id
    WHERE fp.author_id=(SELECT author_id FROM forum_posts WHERE id=p_post_id)
  )+(
    SELECT COALESCE(SUM(CASE WHEN fv.vote_type=1 THEN 5 WHEN fv.vote_type=-1 THEN -1 ELSE 0 END),0)
    FROM forum_votes fv JOIN forum_comments fc ON fv.comment_id=fc.id
    WHERE fc.author_id=(SELECT author_id FROM forum_posts WHERE id=p_post_id)
  )
  WHERE user_id=(SELECT author_id FROM forum_posts WHERE id=p_post_id);
END;$$;

-- ═══ RPC: VOTE ON COMMENT ═══
CREATE OR REPLACE FUNCTION public.vote_on_comment(p_comment_id uuid, p_vote_type smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE existing_vote smallint;
BEGIN
  SELECT vote_type INTO existing_vote FROM forum_votes
    WHERE user_id = auth.uid() AND comment_id = p_comment_id;
  IF existing_vote IS NOT NULL THEN
    IF existing_vote = p_vote_type THEN
      DELETE FROM forum_votes WHERE user_id = auth.uid() AND comment_id = p_comment_id;
    ELSE
      UPDATE forum_votes SET vote_type = p_vote_type WHERE user_id = auth.uid() AND comment_id = p_comment_id;
    END IF;
  ELSE
    INSERT INTO forum_votes (user_id, comment_id, vote_type) VALUES (auth.uid(), p_comment_id, p_vote_type);
  END IF;
  UPDATE forum_comments SET
    upvotes = (SELECT count(*) FROM forum_votes WHERE comment_id = p_comment_id AND vote_type = 1),
    downvotes = (SELECT count(*) FROM forum_votes WHERE comment_id = p_comment_id AND vote_type = -1)
  WHERE id = p_comment_id;
END;$$;

-- ═══ RPC: INCREMENT VIEWS ═══
CREATE OR REPLACE FUNCTION public.increment_post_views(p_post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE forum_posts SET view_count = view_count + 1 WHERE id = p_post_id;
$$;

-- ═══ TRIGGER: UPDATE COMMENT COUNT ═══
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET
      comment_count=(SELECT count(*) FROM forum_comments WHERE post_id=NEW.post_id AND hidden=false),
      last_activity_at=now()
    WHERE id=NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET
      comment_count=(SELECT count(*) FROM forum_comments WHERE post_id=OLD.post_id AND hidden=false)
    WHERE id=OLD.post_id;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS update_post_comment_count ON public.forum_comments;
CREATE TRIGGER update_post_comment_count
  AFTER INSERT OR DELETE ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- ═══ TRIGGER: AUTO-HIDE ON 3 FLAGS ═══
CREATE OR REPLACE FUNCTION public.check_flag_threshold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE forum_posts SET
      flag_count=(SELECT count(*) FROM forum_flags WHERE post_id=NEW.post_id AND resolved=false),
      hidden=(SELECT count(*)>=3 FROM forum_flags WHERE post_id=NEW.post_id AND resolved=false)
    WHERE id=NEW.post_id;
  ELSIF NEW.comment_id IS NOT NULL THEN
    UPDATE forum_comments SET
      flag_count=(SELECT count(*) FROM forum_flags WHERE comment_id=NEW.comment_id AND resolved=false),
      hidden=(SELECT count(*)>=3 FROM forum_flags WHERE comment_id=NEW.comment_id AND resolved=false)
    WHERE id=NEW.comment_id;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS check_flags_after_insert ON public.forum_flags;
CREATE TRIGGER check_flags_after_insert
  AFTER INSERT ON public.forum_flags
  FOR EACH ROW EXECUTE FUNCTION public.check_flag_threshold();
