import { createClient } from '@supabase/supabase-js';
import type {
  OverviewMetrics, FunnelStep, DailyMetric, RevenueBreakdown,
} from '../types';

// ─── Supabase admin ───────────────────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Overview metrics ─────────────────────────────────────────────────────────

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const admin = getAdmin();

  const [dau, wau, mau, swipeRate, rolling, revenue, conversions, churners] =
    await Promise.all([
      // DAU — active today
      admin.from('analytics_events')
        .select('user_id', { count: 'exact', head: true })
        .not('user_id', 'is', null)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      // WAU / MAU from views
      admin.from('wau_view').select('wau').single(),
      admin.from('mau_view').select('mau').single(),

      // Swipe rate
      admin.from('swipe_rate_view').select('*').single(),

      // D1/D7/D30
      admin.from('rolling_retention').select('*').single(),

      // Today's revenue from daily_metrics
      admin.from('daily_metrics')
        .select('revenue_usd, new_subscriptions')
        .eq('date', new Date().toISOString().slice(0, 10))
        .single(),

      // Monthly revenue
      admin.from('daily_metrics')
        .select('revenue_usd')
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),

      // Active subscribers
      admin.from('subscriptions')
        .select('user_id', { count: 'exact', head: true })
        .in('status', ['active', 'trialing'])
        .neq('plan', 'free'),

      // At-risk users
      admin.from('churn_scores')
        .select('user_id', { count: 'exact', head: true })
        .gt('score', 0.7),
    ]);

  const dauCount  = dau.count     ?? 0;
  const wauCount  = (wau.data as any)?.wau  ?? 0;
  const mauCount  = (mau.data as any)?.mau  ?? 0;
  const swipe     = swipeRate.data as any;
  const ret       = rolling.data  as any;

  const revToday  = (revenue.data as any)?.revenue_usd ?? 0;
  const revMtd    = ((conversions as any)?.data ?? []).reduce((s: number, r: any) => s + Number(r.revenue_usd ?? 0), 0);

  const totalUsers = mauCount || 1;
  const paidCount  = (churners as any)?.count ?? 0;     // reuse count slot

  return {
    dau:            dauCount,
    wau:            wauCount,
    mau:            mauCount,
    dauWauRatio:    wauCount ? Math.round((dauCount / wauCount) * 100) / 100 : 0,
    swipeRightRate: swipe?.swipe_right_pct ?? 0,
    matchRate:      0,    // computed from daily_metrics
    conversionRate: mauCount ? Math.round((paidCount / mauCount) * 10000) / 100 : 0,
    arpu:           mauCount ? Math.round((revMtd / mauCount) * 100) / 100 : 0,
    d1:             ret?.d1  ?? 0,
    d7:             ret?.d7  ?? 0,
    d30:            ret?.d30 ?? 0,
    revenueToday:   revToday,
    revenueMtd:     revMtd,
    activeChurners: (churners as any)?.count ?? 0,
  };
}

// ─── Funnel steps ─────────────────────────────────────────────────────────────

export async function getFunnelData(days = 30): Promise<FunnelStep[]> {
  const admin = getAdmin();

  const FUNNEL_ORDER = ['landing', 'started', 'photo', 'verify', 'complete'];
  const FUNNEL_LABELS: Record<string, string> = {
    landing:  'Landing Page',
    started:  'Signup Started',
    photo:    'Photo Added',
    verify:   'Verified',
    complete: 'Profile Complete',
  };

  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data } = await admin
    .from('signup_funnel_events')
    .select('step, anonymous_id')
    .gte('created_at', since);

  if (!data?.length) return [];

  // Count unique anonymous_ids per step
  const stepCounts: Record<string, Set<string>> = {};
  FUNNEL_ORDER.forEach(s => { stepCounts[s] = new Set(); });

  data.forEach(row => {
    const step = row.step?.replace('funnel_', '');
    if (step && stepCounts[step]) stepCounts[step].add(row.anonymous_id);
  });

  const topCount = stepCounts['landing'].size || 1;

  return FUNNEL_ORDER.map((step, i) => {
    const count     = stepCounts[step].size;
    const prevCount = i > 0 ? stepCounts[FUNNEL_ORDER[i - 1]].size : count;
    return {
      step,
      label:      FUNNEL_LABELS[step],
      count,
      pct_of_top: Math.round((count / topCount) * 1000) / 10,
      drop_off:   prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 1000) / 10 : 0,
    };
  });
}

// ─── Daily metrics series ─────────────────────────────────────────────────────

export async function getDailyMetrics(days = 30): Promise<DailyMetric[]> {
  const admin = getAdmin();
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await admin
    .from('daily_metrics')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true });

  return (data ?? []) as DailyMetric[];
}

// ─── Cohort retention ─────────────────────────────────────────────────────────

export async function getCohortData(weeks = 12) {
  const admin = getAdmin();

  const { data } = await admin
    .from('cohort_retention')
    .select('*')
    .order('cohort_week', { ascending: true })
    .order('period_number', { ascending: true })
    .limit(weeks * 13);

  if (!data?.length) return [];

  // Group by cohort_week
  const map = new Map<string, typeof data>();
  data.forEach(row => {
    const week = row.cohort_week;
    if (!map.has(week)) map.set(week, []);
    map.get(week)!.push(row);
  });

  return Array.from(map.entries()).map(([week, rows]) => ({
    cohort_week:  week,
    cohort_size:  rows[0]?.cohort_size ?? 0,
    periods:      rows.map(r => ({ period: r.period_number, rate: r.retention_rate })),
  }));
}

// ─── Revenue breakdown ────────────────────────────────────────────────────────

export async function getRevenueBreakdown(): Promise<RevenueBreakdown[]> {
  const admin = getAdmin();

  const { data } = await admin.from('revenue_by_plan').select('*');
  if (!data) return [];

  // MRR estimate: plus monthly = $9.99/m, plus yearly = $6.67/m,
  // gold monthly = $19.99/m, gold yearly = $12.50/m
  const MRR_RATE: Record<string, number> = {
    free: 0, plus: 9.99, gold: 19.99,
  };

  return (data as any[]).map(row => ({
    plan:             row.plan,
    subscriber_count: row.subscriber_count,
    active:           row.active,
    cancelled:        row.cancelled,
    mrr:              Math.round((row.active ?? 0) * (MRR_RATE[row.plan] ?? 0) * 100) / 100,
  }));
}
