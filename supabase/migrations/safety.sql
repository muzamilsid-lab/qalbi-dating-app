-- ─── Block list ───────────────────────────────────────────────────────────────

CREATE TABLE blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocker ON blocks(blocker_id);
CREATE INDEX blocks_blocked ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON blocks USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ─── Photo visibility ──────────────────────────────────────────────────────────

CREATE TYPE photo_visibility AS ENUM ('public', 'matches', 'private');

-- profile_photos — assumes table was seeded earlier; add visibility column
CREATE TABLE IF NOT EXISTS profile_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,           -- Supabase Storage object key
  order_index SMALLINT NOT NULL DEFAULT 0,
  visibility  photo_visibility NOT NULL DEFAULT 'public',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX photos_user_order ON profile_photos(user_id, order_index);
CREATE INDEX photos_user ON profile_photos(user_id);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo owner"    ON profile_photos FOR ALL   USING (auth.uid() = user_id)  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photo public"   ON profile_photos FOR SELECT USING (visibility = 'public');

-- Per-person reveals (private photos the owner has manually unlocked)
CREATE TABLE photo_reveals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID NOT NULL REFERENCES profile_photos(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revealed_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (photo_id, revealed_to)
);

ALTER TABLE photo_reveals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reveal owner"    ON photo_reveals FOR ALL    USING (auth.uid() = owner_id);
CREATE POLICY "reveal viewer"   ON photo_reveals FOR SELECT USING (auth.uid() = revealed_to);

-- ─── Incognito mode on profiles ───────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS incognito_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_contact JSONB,       -- { name, phone, email }
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';  -- user | moderator | admin

-- ─── Date check-ins ───────────────────────────────────────────────────────────

CREATE TABLE date_checkins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_name           TEXT NOT NULL,                      -- who you're meeting
  date_location       TEXT NOT NULL,
  date_starts_at      TIMESTAMPTZ NOT NULL,
  emergency_contact   JSONB NOT NULL,                     -- { name, phone, email }
  checkin_prompt_at   TIMESTAMPTZ NOT NULL,               -- starts_at + 2h
  checked_in_at       TIMESTAMPTZ,                        -- NULL = not yet
  alerted_at          TIMESTAMPTZ,                        -- NULL = not alerted
  status              TEXT NOT NULL DEFAULT 'pending',    -- pending | safe | alerted | cancelled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX checkins_user ON date_checkins(user_id, created_at DESC);
CREATE INDEX checkins_pending ON date_checkins(checkin_prompt_at)
  WHERE status = 'pending' AND checked_in_at IS NULL;

ALTER TABLE date_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins" ON date_checkins
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Screenshot log (global, not per-conversation) ───────────────────────────

-- Already exists: screenshot_events from chat.sql
-- Add chat-level disable flag to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS screenshots_disabled BOOLEAN NOT NULL DEFAULT false;

-- ─── Unmatch helper ───────────────────────────────────────────────────────────

-- Track unmatches so either side can't see the other
CREATE TABLE unmatches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,       -- references conversations(id) but kept loose for migrations
  initiator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX unmatches_conv ON unmatches(conversation_id);

ALTER TABLE unmatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unmatch own" ON unmatches FOR ALL
  USING (auth.uid() = initiator_id)
  WITH CHECK (auth.uid() = initiator_id);
