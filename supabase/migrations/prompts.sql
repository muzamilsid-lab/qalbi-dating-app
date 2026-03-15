-- ─── Prompt catalogue ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompts (
  id          SERIAL PRIMARY KEY,
  category    TEXT NOT NULL,
  text        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  -- A/B variant: NULL = shown to everyone, 'a'/'b' = experiment arm
  ab_variant  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User prompt answers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_prompts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_id    INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  answer       TEXT NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 250),
  order_index  SMALLINT NOT NULL CHECK (order_index BETWEEN 0 AND 2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, prompt_id),
  UNIQUE (user_id, order_index)
);

CREATE INDEX IF NOT EXISTS profile_prompts_user_id_idx ON profile_prompts(user_id);

-- keep updated_at current
CREATE OR REPLACE FUNCTION update_profile_prompts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profile_prompts_updated_at ON profile_prompts;
CREATE TRIGGER trg_profile_prompts_updated_at
  BEFORE UPDATE ON profile_prompts
  FOR EACH ROW EXECUTE FUNCTION update_profile_prompts_updated_at();

-- ─── Prompt engagement tracking (A/B + gamification) ─────────────────────────

CREATE TABLE IF NOT EXISTS prompt_engagements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id    INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  viewer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('view','like','reply','swipe_right_after')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prompt_eng_prompt_id_idx ON prompt_engagements(prompt_id);
CREATE INDEX IF NOT EXISTS prompt_eng_author_id_idx ON prompt_engagements(author_id);

-- ─── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE prompts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_prompts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_engagements ENABLE ROW LEVEL SECURITY;

-- prompts: public read
CREATE POLICY "prompts_read" ON prompts
  FOR SELECT USING (is_active = TRUE);

-- profile_prompts: users own their rows
CREATE POLICY "pp_select_own" ON profile_prompts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pp_select_others" ON profile_prompts
  FOR SELECT USING (TRUE);   -- discovery may read others' prompts

CREATE POLICY "pp_insert_own" ON profile_prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pp_update_own" ON profile_prompts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pp_delete_own" ON profile_prompts
  FOR DELETE USING (auth.uid() = user_id);

-- engagements: insert by authenticated users
CREATE POLICY "eng_insert_auth" ON prompt_engagements
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "eng_select_own" ON prompt_engagements
  FOR SELECT USING (auth.uid() = author_id OR auth.uid() = viewer_id);

-- ─── Seed prompt catalogue (20+ prompts across 6 categories) ─────────────────

INSERT INTO prompts (category, text) VALUES
  -- About Me
  ('about_me',  'A fact about me that surprises people'),
  ('about_me',  'My most controversial opinion is'),
  ('about_me',  'You''ll know I like you when'),
  ('about_me',  'The most spontaneous thing I''ve ever done'),
  ('about_me',  'I''m weirdly passionate about'),

  -- Lifestyle
  ('lifestyle', 'My ideal weekend looks like'),
  ('lifestyle', 'My go-to order at a café'),
  ('lifestyle', 'The skill I''m currently learning'),
  ('lifestyle', 'A typical Friday night for me'),
  ('lifestyle', 'My simple pleasures are'),

  -- Dating
  ('dating',    'I''m looking for someone who'),
  ('dating',    'On a first date I usually'),
  ('dating',    'The relationship I''m looking for is'),
  ('dating',    'I know it''s a green flag when'),
  ('dating',    'I''ll fall for you if you can'),

  -- Humor
  ('humor',     'The way to my heart is'),
  ('humor',     'My love language in meme form would be'),
  ('humor',     'Two truths and a lie about me'),
  ('humor',     'I will never shut up about'),
  ('humor',     'Unpopular opinion that I stand by'),

  -- Culture
  ('culture',   'My favorite thing about living in the Gulf'),
  ('culture',   'The local dish I could eat every day'),
  ('culture',   'A hidden gem in my city that locals love'),
  ('culture',   'The Arabic word I use most in daily life'),

  -- Values
  ('values',    'I believe that'),
  ('values',    'Something I wish more people talked about'),
  ('values',    'A cause that matters to me'),
  ('values',    'My family taught me')

ON CONFLICT (text) DO NOTHING;
