-- ─── Call status enum ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE call_status_enum AS ENUM (
    'ringing','active','ended','declined','missed','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Video calls ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  initiator_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           call_status_enum NOT NULL DEFAULT 'ringing',
  daily_room_name  TEXT,
  daily_room_url   TEXT,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  ended_by_id      UUID REFERENCES profiles(id),
  extension_count  SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT max_extensions CHECK (extension_count <= 3)
);

CREATE INDEX IF NOT EXISTS vc_conversation_idx ON video_calls(conversation_id);
CREATE INDEX IF NOT EXISTS vc_initiator_idx    ON video_calls(initiator_id);
CREATE INDEX IF NOT EXISTS vc_recipient_idx    ON video_calls(recipient_id);
CREATE INDEX IF NOT EXISTS vc_status_idx       ON video_calls(status) WHERE status IN ('ringing','active');

-- ─── Post-call ratings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id           UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  unmatched_after   BOOLEAN NOT NULL DEFAULT FALSE,
  note              TEXT CHECK (char_length(note) <= 500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (call_id, user_id)
);

-- ─── In-call reports ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id      UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  frame_url    TEXT,   -- captured frame stored in Supabase Storage
  reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_id  UUID REFERENCES profiles(id),
  action_taken TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI moderation flags ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_moderation_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
  flagged_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flag_type       TEXT NOT NULL CHECK (flag_type IN ('nudity','violence','other')),
  confidence      FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  frame_url       TEXT,
  action_taken    TEXT NOT NULL DEFAULT 'none' CHECK (action_taken IN ('none','warned','suspended','banned')),
  reviewed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_flag_call_idx ON ai_moderation_flags(call_id);
CREATE INDEX IF NOT EXISTS ai_flag_unreviewed ON ai_moderation_flags(reviewed) WHERE reviewed = FALSE;

-- ─── Function: end stale ringing calls ───────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_stale_calls()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Calls ringing for >30s with no answer → missed
  UPDATE video_calls
  SET status = 'missed', ended_at = NOW()
  WHERE status = 'ringing'
    AND created_at < NOW() - INTERVAL '30 seconds';

  -- Active calls running > 75 min (15 min × 5 max) → force end
  UPDATE video_calls
  SET status = 'ended', ended_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE status = 'active'
    AND started_at < NOW() - INTERVAL '75 minutes';
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE video_calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vc_participant" ON video_calls
  FOR ALL USING (auth.uid() IN (initiator_id, recipient_id));

CREATE POLICY "rating_own" ON call_ratings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "report_own" ON call_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "report_insert" ON call_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- AI flags: only service role can read/write
CREATE POLICY "ai_flags_service" ON ai_moderation_flags
  FOR ALL USING (FALSE);  -- service role bypasses RLS
