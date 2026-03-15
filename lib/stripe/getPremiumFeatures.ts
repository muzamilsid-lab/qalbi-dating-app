import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import {
  PremiumFeatures, SubscriptionPlan, SubscriptionStatus,
  FREE_FEATURES, PLUS_FEATURES, GOLD_FEATURES,
  SubscriptionRow,
} from './types';

// ─── Redis singleton (reuses env from recommendations) ───────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect:          true,
      maxRetriesPerRequest: 1,
    });
  }
  return _redis;
}

// ─── Supabase service-role client (server only) ───────────────────────────────

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Cache key & TTL ──────────────────────────────────────────────────────────

const FEATURE_TTL = 5 * 60;   // 5 minutes

function cacheKey(userId: string) {
  return `features:${userId}`;
}

// ─── Build features from DB row ───────────────────────────────────────────────

function buildFeatures(row: SubscriptionRow | null): PremiumFeatures {
  if (!row) return FREE_FEATURES;

  const isActive = row.status === 'active' || row.status === 'trialing';

  if (!isActive) return { ...FREE_FEATURES, status: row.status };

  const base = { plan: row.plan as SubscriptionPlan, status: row.status as SubscriptionStatus, isActive };

  switch (row.plan) {
    case 'gold': return { ...base, ...GOLD_FEATURES };
    case 'plus': return { ...base, ...PLUS_FEATURES };
    default:     return { ...FREE_FEATURES, status: row.status as SubscriptionStatus };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the premium feature set for a user.
 * Cached in Redis for 5 minutes to avoid repeated DB calls on every request.
 */
export async function getPremiumFeatures(userId: string): Promise<PremiumFeatures> {
  const redis = getRedis();
  const key   = cacheKey(userId);

  // 1. Try cache
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as PremiumFeatures;
  } catch { /* Redis unavailable — fall through to DB */ }

  // 2. Fetch from DB
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  const features = buildFeatures(data as SubscriptionRow | null);

  // 3. Write to cache (fire and forget)
  try {
    await redis.set(key, JSON.stringify(features), 'EX', FEATURE_TTL);
  } catch { /* ignore */ }

  return features;
}

/**
 * Invalidate a user's cached feature flags.
 * Call after subscription changes (webhook).
 */
export async function invalidateFeaturesCache(userId: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.del(cacheKey(userId));
  } catch { /* ignore */ }
}
