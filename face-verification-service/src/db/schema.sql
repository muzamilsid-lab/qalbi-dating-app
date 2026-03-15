-- ============================================================
-- Face Verification Service — Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM TYPES ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('pending', 'passed', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_result AS ENUM ('success', 'failure', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── VERIFICATION SESSIONS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_sessions (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID         NOT NULL,
  status           session_status NOT NULL DEFAULT 'pending',
  liveness_score   DECIMAL(5,2) CHECK (liveness_score BETWEEN 0 AND 100),
  similarity_score DECIMAL(5,2) CHECK (similarity_score BETWEEN 0 AND 100),
  attempts         INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON verification_sessions(expires_at);

-- ─── FACE REFERENCES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS face_references (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL,
  encrypted_image       TEXT        NOT NULL,   -- AES-256-GCM ciphertext (base64)
  iv                    TEXT        NOT NULL,   -- GCM IV (base64)
  image_hash            TEXT        NOT NULL,   -- SHA-256 of original (dedup)
  rekognition_face_id   TEXT,                   -- AWS Rekognition FaceId
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delete_at             TIMESTAMPTZ NOT NULL,   -- GDPR 24h TTL
  UNIQUE(user_id, image_hash)                   -- prevent duplicate uploads
);

CREATE INDEX IF NOT EXISTS idx_refs_user_id   ON face_references(user_id);
CREATE INDEX IF NOT EXISTS idx_refs_delete_at ON face_references(delete_at);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID        REFERENCES verification_sessions(id) ON DELETE SET NULL,
  user_id     UUID,
  action      TEXT        NOT NULL,
  result      audit_result NOT NULL,
  detail      JSONB       NOT NULL DEFAULT '{}',
  ip_address  INET        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

-- ─── RATE LIMIT STORE ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_store (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CLEANUP FUNCTION (called by cron job) ────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE verification_sessions
  SET    status = 'expired'
  WHERE  status = 'pending'
  AND    expires_at < NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_expired_images()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  DELETE FROM face_references
  WHERE delete_at < NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;
