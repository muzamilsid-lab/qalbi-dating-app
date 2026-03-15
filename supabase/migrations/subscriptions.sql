-- ─── Subscription plan & status enums ────────────────────────────────────────

CREATE TYPE subscription_plan   AS ENUM ('free', 'plus', 'gold');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trialing');

-- ─── Add Stripe customer ID to profiles ───────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ─── Subscriptions table ──────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  plan                    subscription_plan   NOT NULL DEFAULT 'free',
  status                  subscription_status NOT NULL DEFAULT 'active',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  trial_end               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_user_id_idx ON subscriptions(user_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (webhooks use service role)
CREATE POLICY "service role full access" ON subscriptions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Stripe events log (idempotency) ──────────────────────────────────────────

CREATE TABLE stripe_webhook_events (
  id          TEXT PRIMARY KEY,          -- Stripe event ID
  type        TEXT NOT NULL,
  processed   BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Only service role touches this table — no user policies needed

-- ─── Seed free subscription for existing users ───────────────────────────────
-- (Run manually or adapt for your user population)
-- INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
-- SELECT id, '', 'free', 'active' FROM profiles
-- ON CONFLICT DO NOTHING;
