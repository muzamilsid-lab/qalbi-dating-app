-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE moderation_content_type AS ENUM ('photo', 'message', 'profile');
CREATE TYPE moderation_detection_source AS ENUM ('ai', 'report', 'pattern');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE moderation_action AS ENUM (
  'none', 'content_removed', 'warning', 'temp_ban', 'perm_ban'
);

CREATE TYPE report_reason AS ENUM (
  'fake_profile', 'inappropriate_photos', 'harassment',
  'underage', 'spam', 'other'
);
CREATE TYPE report_status AS ENUM ('pending', 'investigating', 'resolved');

-- ─── moderation_queue ─────────────────────────────────────────────────────────

CREATE TABLE moderation_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type     moderation_content_type  NOT NULL,
  content_id       UUID                     NOT NULL,
  user_id          UUID                     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  detection_source moderation_detection_source NOT NULL,
  detection_reason TEXT                     NOT NULL,
  confidence       DECIMAL(5,4),            -- 0.0000 – 1.0000
  raw_labels       JSONB,                   -- full provider response
  status           moderation_status        NOT NULL DEFAULT 'pending',
  priority         SMALLINT                 NOT NULL DEFAULT 0,  -- higher = more urgent
  reviewed_by      UUID                     REFERENCES profiles(id),
  reviewed_at      TIMESTAMPTZ,
  action_taken     moderation_action        NOT NULL DEFAULT 'none',
  moderator_note   TEXT,
  created_at       TIMESTAMPTZ              NOT NULL DEFAULT now()
);

CREATE INDEX mq_status_priority ON moderation_queue(status, priority DESC, created_at ASC)
  WHERE status = 'pending';
CREATE INDEX mq_user_id ON moderation_queue(user_id);
CREATE INDEX mq_content ON moderation_queue(content_type, content_id);

-- ─── reports ─────────────────────────────────────────────────────────────────

CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason           report_reason NOT NULL,
  details          TEXT,
  evidence_urls    TEXT[]      NOT NULL DEFAULT '{}',
  status           report_status NOT NULL DEFAULT 'pending',
  outcome          TEXT,
  queue_item_id    UUID        REFERENCES moderation_queue(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_reported ON reports(reported_user_id, created_at DESC);
CREATE INDEX reports_status   ON reports(status) WHERE status = 'pending';
-- Prevent duplicate reports (same reporter + reported + reason within 24h)
CREATE UNIQUE INDEX reports_dedup ON reports(reporter_id, reported_user_id, reason)
  WHERE created_at > now() - interval '24 hours';

-- ─── user_suspensions ─────────────────────────────────────────────────────────

CREATE TABLE user_suspensions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,  -- 'auto_pending', 'warning', 'temp_ban', 'perm_ban'
  reason       TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ,           -- NULL = permanent
  lifted_by    UUID        REFERENCES profiles(id),
  lifted_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX suspensions_user ON user_suspensions(user_id, created_at DESC);

-- Active suspension view
CREATE VIEW active_suspensions AS
  SELECT * FROM user_suspensions
  WHERE lifted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE moderation_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_suspensions   ENABLE ROW LEVEL SECURITY;

-- Only service role accesses moderation_queue (moderator dashboard uses service role)
CREATE POLICY "service_role_only" ON moderation_queue
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can create reports and read their own
CREATE POLICY "report_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "report_read_own" ON reports FOR SELECT
  USING (auth.uid() = reporter_id);
CREATE POLICY "report_service_role" ON reports
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can read their own suspensions
CREATE POLICY "suspension_read_own" ON user_suspensions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "suspension_service_role" ON user_suspensions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Escalation trigger: 3 unique reporters → auto-suspend ───────────────────

CREATE OR REPLACE FUNCTION check_report_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  unique_reporters INT;
  is_underage      BOOLEAN;
BEGIN
  -- Count unique reporters in the last 30 days
  SELECT COUNT(DISTINCT reporter_id) INTO unique_reporters
  FROM reports
  WHERE reported_user_id = NEW.reported_user_id
    AND status IN ('pending', 'investigating')
    AND created_at > now() - interval '30 days';

  is_underage := NEW.reason = 'underage';

  -- Underage: immediate priority suspension
  IF is_underage THEN
    INSERT INTO user_suspensions (user_id, type, reason)
    VALUES (NEW.reported_user_id, 'auto_pending',
            'Underage report — immediate suspension pending review');

    -- Escalate to priority in queue
    INSERT INTO moderation_queue (
      content_type, content_id, user_id,
      detection_source, detection_reason,
      confidence, status, priority
    ) VALUES (
      'profile', NEW.reported_user_id, NEW.reported_user_id,
      'report', 'Underage report — URGENT',
      1.0, 'pending', 100
    ) ON CONFLICT DO NOTHING;

  -- 3 unique reporters: auto-suspend pending review
  ELSIF unique_reporters >= 3 THEN
    INSERT INTO user_suspensions (user_id, type, reason)
    VALUES (NEW.reported_user_id, 'auto_pending',
            format('%s unique reporters in 30 days', unique_reporters))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_report_escalation
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_escalation();
