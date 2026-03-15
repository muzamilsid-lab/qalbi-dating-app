-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Types ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE content_type_enum AS ENUM (
    'text','image','voice','gif','location','date_suggestion','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Conversations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             UUID REFERENCES matches(id) ON DELETE CASCADE,
  last_message_id      UUID,
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_a_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_a_unread_count  INTEGER NOT NULL DEFAULT 0,
  user_b_unread_count  INTEGER NOT NULL DEFAULT 0,
  user_a_deleted_at    TIMESTAMPTZ,
  user_b_deleted_at    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (match_id),
  CONSTRAINT different_users CHECK (user_a_id <> user_b_id),
  CONSTRAINT ordered_users   CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS conv_user_a_idx ON conversations(user_a_id);
CREATE INDEX IF NOT EXISTS conv_user_b_idx ON conversations(user_b_id);
CREATE INDEX IF NOT EXISTS conv_activity_idx ON conversations(last_activity_at DESC);

-- ─── E2E Key Exchange ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_public_keys (
  user_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  identity_key     TEXT NOT NULL,   -- Curve25519 public key (base64)
  signed_prekey    TEXT NOT NULL,   -- Signed prekey (base64)
  prekey_signature TEXT NOT NULL,   -- Signature of signed_prekey
  one_time_prekeys TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_encrypted BYTEA,           -- AES-256-GCM ciphertext (null for system msgs)
  content_type      content_type_enum NOT NULL DEFAULT 'text',
  metadata          JSONB NOT NULL DEFAULT '{}',
  -- metadata shape per type:
  -- text:            { nonce: string }
  -- image:           { nonce, url, width, height, blur_hash, size_bytes }
  -- voice:           { nonce, url, duration_ms, waveform: number[] }
  -- gif:             { giphy_id, url, width, height, title }
  -- location:        { nonce, lat, lng, label }
  -- date_suggestion: { nonce, suggested_at, venue_name, venue_address, note }
  -- system:          { event: 'match'|'block'|'disappear_enabled' }
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  -- Disappearing messages
  expires_at        TIMESTAMPTZ,
  -- Unsend window (5 min from sent_at)
  unsent_at         TIMESTAMPTZ,

  CONSTRAINT sent_before_expires CHECK (expires_at IS NULL OR expires_at > sent_at)
);

CREATE INDEX IF NOT EXISTS msg_conv_sent_idx ON messages(conversation_id, sent_at DESC)
  WHERE deleted_at IS NULL AND unsent_at IS NULL;
CREATE INDEX IF NOT EXISTS msg_sender_idx    ON messages(sender_id);
CREATE INDEX IF NOT EXISTS msg_expires_idx   ON messages(expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Forward-ref from conversations
ALTER TABLE conversations
  ADD CONSTRAINT fk_last_message FOREIGN KEY (last_message_id)
  REFERENCES messages(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ─── Message reads (per-user read tracking) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS message_reads (
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- ─── Typing events (ephemeral; short TTL rows) ────────────────────────────────

CREATE TABLE IF NOT EXISTS typing_events (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 seconds'),
  PRIMARY KEY (conversation_id, user_id)
);

-- ─── Privacy settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_privacy_settings (
  user_id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  read_receipts        BOOLEAN NOT NULL DEFAULT TRUE,
  disappearing_default BOOLEAN NOT NULL DEFAULT FALSE,
  screenshot_notify    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Screenshot events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS screenshot_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  taker_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Functions ────────────────────────────────────────────────────────────────

-- Update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  UPDATE conversations SET
    last_message_id  = NEW.id,
    last_activity_at = NEW.sent_at,
    user_a_unread_count = CASE
      WHEN v_conv.user_a_id <> NEW.sender_id
      THEN user_a_unread_count + 1
      ELSE user_a_unread_count
    END,
    user_b_unread_count = CASE
      WHEN v_conv.user_b_id <> NEW.sender_id
      THEN user_b_unread_count + 1
      ELSE user_b_unread_count
    END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_on_msg ON messages;
CREATE TRIGGER trg_update_conv_on_msg
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Mark delivered on message insert (received by server = delivered)
CREATE OR REPLACE FUNCTION auto_mark_delivered()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.delivered_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_delivered ON messages;
CREATE TRIGGER trg_auto_delivered
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION auto_mark_delivered();

-- Expire disappearing messages (called by cron)
CREATE OR REPLACE FUNCTION expire_disappearing_messages()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE messages
  SET deleted_at = NOW()
  WHERE expires_at <= NOW()
    AND deleted_at IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Cleanup stale typing events
CREATE OR REPLACE FUNCTION cleanup_typing_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM typing_events WHERE expires_at <= NOW();
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_public_keys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_privacy_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshot_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_events          ENABLE ROW LEVEL SECURITY;

-- Conversations: participants only
CREATE POLICY "conv_participant" ON conversations
  FOR ALL USING (auth.uid() IN (user_a_id, user_b_id));

-- Messages: participants of the conversation
CREATE POLICY "msg_participant" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() IN (user_a_id, user_b_id)
    )
    AND deleted_at IS NULL
    AND unsent_at IS NULL
  );

CREATE POLICY "msg_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "msg_update_own" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- Message reads
CREATE POLICY "reads_own" ON message_reads
  FOR ALL USING (auth.uid() = user_id);

-- Public keys: readable by all auth users (needed for key exchange)
CREATE POLICY "pubkeys_read"   ON user_public_keys FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pubkeys_own"    ON user_public_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pubkeys_update" ON user_public_keys FOR UPDATE USING (auth.uid() = user_id);

-- Privacy settings
CREATE POLICY "privacy_own" ON chat_privacy_settings
  FOR ALL USING (auth.uid() = user_id);

-- Screenshot events: conversation participants
CREATE POLICY "screenshot_participant" ON screenshot_events
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE auth.uid() IN (user_a_id, user_b_id)
    )
  );
CREATE POLICY "screenshot_insert" ON screenshot_events
  FOR INSERT WITH CHECK (auth.uid() = taker_id);

-- Typing events
CREATE POLICY "typing_participant" ON typing_events
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE auth.uid() IN (user_a_id, user_b_id)
    )
  );
CREATE POLICY "typing_own" ON typing_events
  FOR ALL USING (auth.uid() = user_id);
