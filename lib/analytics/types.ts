// ─── Event catalogue ──────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | 'app_opened'
  | 'signup_started'
  | 'signup_completed'
  | 'profile_photo_added'
  | 'verification_completed'
  | 'discovery_session_started'
  | 'card_viewed'
  | 'swipe_left'
  | 'swipe_right'
  | 'super_like'
  | 'match_created'
  | 'chat_opened'
  | 'message_sent'
  | 'video_call_started'
  | 'subscription_started'
  | 'subscription_cancelled'
  // Funnel
  | 'funnel_landing'
  | 'funnel_started'
  | 'funnel_photo'
  | 'funnel_verify'
  | 'funnel_complete';

// ─── Event properties ─────────────────────────────────────────────────────────

export interface EventProperties {
  // Common
  session_id?:       string;
  platform?:         'web' | 'ios' | 'android';
  app_version?:      string;
  source?:           'organic' | 'referral' | 'paid' | 'unknown';
  channel?:          string;      // utm_source
  referrer?:         string;

  // card_viewed
  profile_id?:       string;
  position?:         number;

  // swipe events
  swipe_duration_ms?: number;

  // match_created
  match_id?:         string;

  // message_sent
  conversation_id?:  string;
  content_type?:     string;
  message_length?:   number;

  // video_call_started
  call_id?:          string;

  // subscription events
  plan?:             string;
  interval?:         string;
  revenue?:          number;

  // Arbitrary extra properties
  [key: string]:     unknown;
}

export interface TrackedEvent {
  event:       AnalyticsEvent;
  userId?:     string;
  anonymousId: string;
  sessionId:   string;
  properties:  EventProperties;
  timestamp:   string;
}

// ─── Metric shapes ────────────────────────────────────────────────────────────

export interface DailyMetric {
  date:                   string;
  dau:                    number;
  new_signups:            number;
  signups_organic:        number;
  signups_referral:       number;
  signups_paid:           number;
  total_sessions:         number;
  avg_session_seconds:    number | null;
  median_session_seconds: number | null;
  total_swipes:           number;
  swipes_right:           number;
  swipe_right_rate:       number | null;
  total_matches:          number;
  match_rate:             number | null;
  conversations_started:  number;
  messages_sent:          number;
  video_calls_started:    number;
  new_subscriptions:      number;
  revenue_usd:            number;
}

export interface FunnelStep {
  step:        string;
  label:       string;
  count:       number;
  pct_of_top:  number;
  drop_off?:   number;
}

export interface CohortRow {
  cohort_week:    string;
  cohort_size:    number;
  periods:        Array<{ period: number; rate: number }>;
}

export interface OverviewMetrics {
  dau:             number;
  wau:             number;
  mau:             number;
  dauWauRatio:     number;
  swipeRightRate:  number;
  matchRate:       number;
  conversionRate:  number;   // free → paid
  arpu:            number;
  d1:              number;
  d7:              number;
  d30:             number;
  revenueToday:    number;
  revenueMtd:      number;
  activeChurners:  number;   // users with churn score > 0.7
}

export interface RevenueBreakdown {
  plan:             string;
  subscriber_count: number;
  active:           number;
  cancelled:        number;
  mrr:              number;
}
