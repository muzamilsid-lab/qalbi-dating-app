/**
 * ChurnPredictor — simple heuristic churn scoring.
 *
 * Score = weighted sum of risk factors, clamped to [0, 1].
 * Run nightly via the ETL job.
 *
 * Factors:
 *   - Days since last login (35%)
 *   - Declining swipe activity trend (20%)
 *   - No messages sent in 14 days (20%)
 *   - Paid subscription nearing end (15%)
 *   - Profile completion < 60% (10%)
 */

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface ChurnFactors {
  days_since_login:      number;
  swipe_trend:           number;    // negative = declining
  messages_last_14d:     number;
  subscription_days_left: number | null;
  profile_completeness:  number;    // 0–100
}

function computeScore(f: ChurnFactors): number {
  let score = 0;

  // Days since login: 0d=0, 3d=0.3, 7d=0.6, 14d=0.9, 21d+=1.0
  score += 0.35 * Math.min(1, f.days_since_login / 21);

  // Swipe trend: declining = higher risk
  score += 0.20 * Math.max(0, Math.min(1, -f.swipe_trend / 10));

  // No messages = higher risk
  score += 0.20 * (f.messages_last_14d === 0 ? 1 : Math.max(0, 1 - f.messages_last_14d / 5));

  // Subscription end approaching
  if (f.subscription_days_left !== null) {
    score += 0.15 * (f.subscription_days_left <= 7 ? 1 : f.subscription_days_left <= 30 ? 0.5 : 0);
  }

  // Incomplete profile
  score += 0.10 * Math.max(0, (60 - f.profile_completeness) / 60);

  return Math.min(1, Math.max(0, score));
}

// ─── Compute for all active users ────────────────────────────────────────────

export async function computeChurnScores(): Promise<number> {
  const admin = getAdmin();
  const now   = new Date();

  // Fetch users active in last 60 days
  const { data: users } = await admin
    .from('profiles')
    .select('id, created_at')
    .gt('last_active_at', new Date(Date.now() - 60 * 86400_000).toISOString())
    .limit(50_000);

  if (!users?.length) return 0;

  let processed = 0;

  // Process in batches
  const BATCH = 200;
  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    const userIds = batch.map(u => u.id);

    const [lastLogins, swipeCounts14, swipeCounts28, msgCounts, subs] = await Promise.all([
      // Last event per user
      admin.from('analytics_events')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(userIds.length),

      // Swipes last 14d
      admin.from('analytics_events')
        .select('user_id')
        .in('user_id', userIds)
        .in('event_name', ['swipe_left', 'swipe_right', 'super_like'])
        .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString()),

      // Swipes 14–28d (for trend)
      admin.from('analytics_events')
        .select('user_id')
        .in('user_id', userIds)
        .in('event_name', ['swipe_left', 'swipe_right', 'super_like'])
        .gte('created_at', new Date(Date.now() - 28 * 86400_000).toISOString())
        .lt('created_at',  new Date(Date.now() - 14 * 86400_000).toISOString()),

      // Messages last 14d
      admin.from('analytics_events')
        .select('user_id')
        .in('user_id', userIds)
        .eq('event_name', 'message_sent')
        .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString()),

      // Subscriptions
      admin.from('subscriptions')
        .select('user_id, current_period_end, status')
        .in('user_id', userIds)
        .in('status', ['active', 'trialing']),
    ]);

    // Aggregate per user
    const loginMap  = new Map<string, string>();
    const s14Map    = new Map<string, number>();
    const s28Map    = new Map<string, number>();
    const msgMap    = new Map<string, number>();
    const subMap    = new Map<string, string | null>();

    lastLogins.data?.forEach(r => {
      if (!loginMap.has(r.user_id)) loginMap.set(r.user_id, r.created_at);
    });
    swipeCounts14.data?.forEach(r => s14Map.set(r.user_id, (s14Map.get(r.user_id) ?? 0) + 1));
    swipeCounts28.data?.forEach(r => s28Map.set(r.user_id, (s28Map.get(r.user_id) ?? 0) + 1));
    msgCounts.data?.forEach(r => msgMap.set(r.user_id, (msgMap.get(r.user_id) ?? 0) + 1));
    subs.data?.forEach(r => subMap.set(r.user_id, r.current_period_end));

    // Build upsert payload
    const upserts = batch.map(user => {
      const lastLogin  = loginMap.get(user.id);
      const daysAgo    = lastLogin
        ? Math.floor((now.getTime() - new Date(lastLogin).getTime()) / 86400_000)
        : 60;

      const s14      = s14Map.get(user.id) ?? 0;
      const s28      = s28Map.get(user.id) ?? 0;
      const swipeTrend = s14 - s28;   // positive = growing

      const msgs     = msgMap.get(user.id) ?? 0;
      const periodEnd = subMap.get(user.id);
      const daysLeft  = periodEnd
        ? Math.floor((new Date(periodEnd).getTime() - now.getTime()) / 86400_000)
        : null;

      const factors: ChurnFactors = {
        days_since_login:       daysAgo,
        swipe_trend:            swipeTrend,
        messages_last_14d:      msgs,
        subscription_days_left: daysLeft,
        profile_completeness:   70,   // TODO: wire to actual profile completeness score
      };

      return {
        user_id:          user.id,
        score:            computeScore(factors),
        factors:          factors as unknown as Record<string, unknown>,
        days_since_login: daysAgo,
        computed_at:      now.toISOString(),
      };
    });

    await admin.from('churn_scores').upsert(upserts, { onConflict: 'user_id' });
    processed += batch.length;
  }

  return processed;
}
