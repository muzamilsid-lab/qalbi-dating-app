-- ─── Raw events table ─────────────────────────────────────────────────────────

CREATE TABLE analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT        NOT NULL,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  anonymous_id TEXT,                         -- pre-auth / logged-out identifier
  session_id   TEXT,
  properties   JSONB       NOT NULL DEFAULT '{}',
  source       TEXT,                         -- organic | referral | paid | unknown
  channel      TEXT,                         -- utm_source value
  app_version  TEXT,
  platform     TEXT,                         -- web | ios | android
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ae_user_created    ON analytics_events(user_id, created_at DESC);
CREATE INDEX ae_name_created    ON analytics_events(event_name, created_at DESC);
CREATE INDEX ae_session         ON analytics_events(session_id, created_at);
CREATE INDEX ae_created         ON analytics_events(created_at DESC);
-- BRIN index for time-range scans on append-only table
CREATE INDEX ae_created_brin    ON analytics_events USING BRIN(created_at);

-- Partition by month for production scale (optional — enable when row count warrants)
-- ALTER TABLE analytics_events PARTITION BY RANGE (created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
-- Only service role writes; no user read (privacy)
CREATE POLICY "service_role_only" ON analytics_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Signup funnel steps ──────────────────────────────────────────────────────

CREATE TABLE signup_funnel_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id TEXT        NOT NULL,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  step         TEXT        NOT NULL,   -- landing | started | photo | verify | complete
  source       TEXT,
  channel      TEXT,
  referrer     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sfe_anon      ON signup_funnel_events(anonymous_id, created_at);
CREATE INDEX sfe_step      ON signup_funnel_events(step, created_at DESC);
CREATE INDEX sfe_created   ON signup_funnel_events(created_at DESC);

ALTER TABLE signup_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON signup_funnel_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Daily aggregates (materialised by ETL) ───────────────────────────────────

CREATE TABLE daily_metrics (
  date                  DATE        PRIMARY KEY,
  dau                   INT         NOT NULL DEFAULT 0,
  new_signups           INT         NOT NULL DEFAULT 0,
  signups_organic       INT         NOT NULL DEFAULT 0,
  signups_referral      INT         NOT NULL DEFAULT 0,
  signups_paid          INT         NOT NULL DEFAULT 0,
  total_sessions        INT         NOT NULL DEFAULT 0,
  avg_session_seconds   FLOAT,
  median_session_seconds FLOAT,
  total_swipes          BIGINT      NOT NULL DEFAULT 0,
  swipes_right          BIGINT      NOT NULL DEFAULT 0,
  swipe_right_rate      FLOAT,
  total_matches         INT         NOT NULL DEFAULT 0,
  match_rate            FLOAT,
  conversations_started INT         NOT NULL DEFAULT 0,
  messages_sent         BIGINT      NOT NULL DEFAULT 0,
  video_calls_started   INT         NOT NULL DEFAULT 0,
  new_subscriptions     INT         NOT NULL DEFAULT 0,
  revenue_usd           NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Cohort retention ─────────────────────────────────────────────────────────

CREATE TABLE cohort_retention (
  cohort_week      DATE    NOT NULL,     -- Monday of signup week
  period_number    INT     NOT NULL,     -- 0=same week,1=W+1,...,12=W+12
  cohort_size      INT     NOT NULL,
  retained_users   INT     NOT NULL,
  retention_rate   FLOAT   NOT NULL,
  PRIMARY KEY (cohort_week, period_number)
);

-- ─── User-level churn scores (updated nightly) ────────────────────────────────

CREATE TABLE churn_scores (
  user_id          UUID    PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  score            FLOAT   NOT NULL,    -- 0.0 = certain to stay, 1.0 = certain to churn
  factors          JSONB   NOT NULL DEFAULT '{}',
  days_since_login INT,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Convenience views ────────────────────────────────────────────────────────

-- WAU: unique users active in last 7 days
CREATE OR REPLACE VIEW wau_view AS
  SELECT COUNT(DISTINCT user_id) AS wau
  FROM analytics_events
  WHERE user_id IS NOT NULL
    AND created_at >= now() - interval '7 days';

-- MAU: unique users active in last 30 days
CREATE OR REPLACE VIEW mau_view AS
  SELECT COUNT(DISTINCT user_id) AS mau
  FROM analytics_events
  WHERE user_id IS NOT NULL
    AND created_at >= now() - interval '30 days';

-- Swipe right rate (last 30 days)
CREATE OR REPLACE VIEW swipe_rate_view AS
  SELECT
    COUNT(*) FILTER (WHERE event_name IN ('swipe_right','super_like')) AS likes,
    COUNT(*) AS total_swipes,
    ROUND(
      COUNT(*) FILTER (WHERE event_name IN ('swipe_right','super_like'))::NUMERIC
      / NULLIF(COUNT(*), 0) * 100, 2
    ) AS swipe_right_pct
  FROM analytics_events
  WHERE event_name IN ('swipe_left','swipe_right','super_like')
    AND created_at >= now() - interval '30 days';

-- D1 / D7 / D30 retention (rolling, approximate)
CREATE OR REPLACE VIEW rolling_retention AS
  SELECT
    ROUND(AVG(CASE WHEN days_since_signup = 1  THEN 1.0 ELSE 0.0 END) * 100, 2) AS d1,
    ROUND(AVG(CASE WHEN days_since_signup = 7  THEN 1.0 ELSE 0.0 END) * 100, 2) AS d7,
    ROUND(AVG(CASE WHEN days_since_signup = 30 THEN 1.0 ELSE 0.0 END) * 100, 2) AS d30
  FROM (
    SELECT
      u.id,
      EXTRACT(DAY FROM MAX(e.created_at) - u.created_at)::INT AS days_since_signup
    FROM profiles u
    JOIN analytics_events e ON e.user_id = u.id
    WHERE u.created_at >= now() - interval '60 days'
    GROUP BY u.id, u.created_at
  ) t;

-- Funnel conversion rates
CREATE OR REPLACE VIEW funnel_view AS
  WITH steps AS (
    SELECT step, COUNT(DISTINCT anonymous_id) AS cnt
    FROM signup_funnel_events
    WHERE created_at >= now() - interval '30 days'
    GROUP BY step
  )
  SELECT
    step,
    cnt,
    ROUND(cnt::NUMERIC / NULLIF(MAX(cnt) OVER (), 0) * 100, 1) AS pct_of_top
  FROM steps;

-- Revenue by plan (last 30 days from subscriptions table)
CREATE OR REPLACE VIEW revenue_by_plan AS
  SELECT
    plan,
    COUNT(*) AS subscriber_count,
    COUNT(*) FILTER (WHERE status = 'active')    AS active,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
  FROM subscriptions
  GROUP BY plan;
