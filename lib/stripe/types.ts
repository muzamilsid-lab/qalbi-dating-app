// ─── Plans & features ─────────────────────────────────────────────────────────

export type SubscriptionPlan   = 'free' | 'plus' | 'gold';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export type BillingInterval = 'monthly' | 'yearly';

// ─── Product catalogue ────────────────────────────────────────────────────────

export interface PlanConfig {
  id:            string;          // Stripe Price ID env key
  plan:          SubscriptionPlan;
  interval:      BillingInterval;
  priceUsd:      number;          // in dollars
  monthlyEquiv:  number;          // for yearly plans: effective monthly rate
  savingPct?:    number;          // percentage saved vs monthly
  label:         string;
  badge?:        string;
}

export const PLANS: PlanConfig[] = [
  {
    id:           'STRIPE_PRICE_PLUS_MONTHLY',
    plan:         'plus',
    interval:     'monthly',
    priceUsd:     9.99,
    monthlyEquiv: 9.99,
    label:        'Qalbi Plus',
  },
  {
    id:           'STRIPE_PRICE_PLUS_YEARLY',
    plan:         'plus',
    interval:     'yearly',
    priceUsd:     79.99,
    monthlyEquiv: 6.67,
    savingPct:    33,
    label:        'Qalbi Plus',
    badge:        'Save 33%',
  },
  {
    id:           'STRIPE_PRICE_GOLD_MONTHLY',
    plan:         'gold',
    interval:     'monthly',
    priceUsd:     19.99,
    monthlyEquiv: 19.99,
    label:        'Qalbi Gold',
  },
  {
    id:           'STRIPE_PRICE_GOLD_YEARLY',
    plan:         'gold',
    interval:     'yearly',
    priceUsd:     149.99,
    monthlyEquiv: 12.50,
    savingPct:    37,
    label:        'Qalbi Gold',
    badge:        'Most Popular',
  },
];

// ─── Feature flags per plan ────────────────────────────────────────────────────

export interface PremiumFeatures {
  plan:              SubscriptionPlan;
  status:            SubscriptionStatus;
  isActive:          boolean;       // active or trialing

  // Free
  canSwipe:          boolean;       // always true
  dailyLikeLimit:    number;        // free=10, plus=50, gold=unlimited(-1)

  // Plus
  canSeeWhoLikedYou: boolean;
  canRewind:         boolean;       // undo last swipe
  unlimitedLikes:    boolean;
  boostsPerMonth:    number;        // 0 free, 1 plus, 5 gold
  passportMode:      boolean;       // browse other cities

  // Gold
  priorityDiscovery: boolean;       // shown higher in others' feeds
  readReceipts:      boolean;       // see if messages read
  advancedFilters:   boolean;       // height, education, religion filters
  profileHighlight:  boolean;       // golden ring on profile card
  incognitoMode:     boolean;       // browse without showing
  dedicatedSupport:  boolean;
}

export const FREE_FEATURES: PremiumFeatures = {
  plan:              'free',
  status:            'active',
  isActive:          true,
  canSwipe:          true,
  dailyLikeLimit:    10,
  canSeeWhoLikedYou: false,
  canRewind:         false,
  unlimitedLikes:    false,
  boostsPerMonth:    0,
  passportMode:      false,
  priorityDiscovery: false,
  readReceipts:      false,
  advancedFilters:   false,
  profileHighlight:  false,
  incognitoMode:     false,
  dedicatedSupport:  false,
};

export const PLUS_FEATURES: Omit<PremiumFeatures, 'plan' | 'status' | 'isActive'> = {
  canSwipe:          true,
  dailyLikeLimit:    50,
  canSeeWhoLikedYou: true,
  canRewind:         true,
  unlimitedLikes:    false,
  boostsPerMonth:    1,
  passportMode:      true,
  priorityDiscovery: false,
  readReceipts:      false,
  advancedFilters:   false,
  profileHighlight:  false,
  incognitoMode:     false,
  dedicatedSupport:  false,
};

export const GOLD_FEATURES: Omit<PremiumFeatures, 'plan' | 'status' | 'isActive'> = {
  canSwipe:          true,
  dailyLikeLimit:    -1,           // unlimited
  canSeeWhoLikedYou: true,
  canRewind:         true,
  unlimitedLikes:    true,
  boostsPerMonth:    5,
  passportMode:      true,
  priorityDiscovery: true,
  readReceipts:      true,
  advancedFilters:   true,
  profileHighlight:  true,
  incognitoMode:     true,
  dedicatedSupport:  true,
};

// ─── DB row types ──────────────────────────────────────────────────────────────

export interface SubscriptionRow {
  id:                     string;
  user_id:                string;
  stripe_subscription_id: string | null;
  stripe_customer_id:     string;
  plan:                   SubscriptionPlan;
  status:                 SubscriptionStatus;
  current_period_start:   string | null;
  current_period_end:     string | null;
  cancel_at_period_end:   boolean;
  trial_end:              string | null;
}
