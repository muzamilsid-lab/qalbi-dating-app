'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import clsx                                 from 'clsx';
import { MetricCard }                       from './MetricCard';
import { FunnelChart }                      from './FunnelChart';
import { CohortGrid }                       from './CohortGrid';
import { SparkLine }                        from './SparkLine';
import type {
  OverviewMetrics, FunnelStep, CohortRow,
  DailyMetric, RevenueBreakdown,
} from '@/lib/analytics/types';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'acquisition' | 'engagement' | 'retention' | 'monetization';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',      label: 'Overview',      icon: '📊' },
  { id: 'acquisition',   label: 'Acquisition',   icon: '🚀' },
  { id: 'engagement',    label: 'Engagement',    icon: '💬' },
  { id: 'retention',     label: 'Retention',     icon: '🔄' },
  { id: 'monetization',  label: 'Monetization',  icon: '💰' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useMetric<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [tab, setTab]         = useState<Tab>('overview');
  const [range, setRange]     = useState(30);

  const overview   = useMetric<OverviewMetrics>('/api/analytics/metrics?type=overview');
  const daily      = useMetric<DailyMetric[]>(`/api/analytics/metrics?type=daily&days=${range}`);
  const funnel     = useMetric<FunnelStep[]>(`/api/analytics/funnel?days=${range}`);
  const cohorts    = useMetric<CohortRow[]>('/api/analytics/metrics?type=cohorts');
  const revenue    = useMetric<RevenueBreakdown[]>('/api/analytics/metrics?type=revenue');

  const o  = overview.data;
  const dm = daily.data ?? [];

  // Spark data from daily series
  const dauSpark  = dm.map(d => d.dau);
  const revSpark  = dm.map(d => Number(d.revenue_usd));
  const swipeSpark = dm.map(d => (d.swipe_right_rate ?? 0) * 100);

  const totalMrr = (revenue.data ?? []).reduce((s, r) => s + r.mrr, 0);

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-neutral-500 text-sm">Qalbi product metrics</p>
        </div>

        {/* Range picker */}
        <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                range === d ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-white',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-neutral-900 p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.id ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white',
            )}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >

          {/* ── Overview ──────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="DAU"  value={o ? fmt(o.dau)  : '—'} icon="👥" sub={o ? `WAU ${fmt(o.wau)}` : undefined} />
                <MetricCard label="MAU"  value={o ? fmt(o.mau)  : '—'} icon="📅" sub={o ? `DAU/WAU ${o.dauWauRatio.toFixed(2)}` : undefined} />
                <MetricCard label="MRR"  value={usd(totalMrr)}          icon="💰" highlight />
                <MetricCard label="Revenue MTD" value={o ? usd(o.revenueMtd) : '—'} icon="📈" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard label="Swipe Right Rate"    value={o ? pct(o.swipeRightRate) : '—'} icon="👍" />
                <MetricCard label="Free → Paid Conv."   value={o ? pct(o.conversionRate) : '—'} icon="⬆️" />
                <MetricCard label="ARPU (MTD)"          value={o ? usd(o.arpu) : '—'}           icon="🧮" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="D1 Retention"  value={o ? pct(o.d1) : '—'}  icon="📌" />
                <MetricCard label="D7 Retention"  value={o ? pct(o.d7) : '—'}  icon="📌" />
                <MetricCard label="D30 Retention" value={o ? pct(o.d30) : '—'} icon="📌" />
              </div>

              {/* Spark lines row */}
              {dm.length > 1 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'DAU trend',   data: dauSpark,  color: '#a855f7' },
                    { label: 'Revenue',     data: revSpark,  color: '#22c55e' },
                    { label: 'Swipe rate',  data: swipeSpark, color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 flex flex-col gap-2">
                      <p className="text-xs text-neutral-500">{s.label}</p>
                      <SparkLine data={s.data} color={s.color} fillColor={s.color} width={200} height={40} />
                    </div>
                  ))}
                </div>
              )}

              {/* At-risk users */}
              {o && o.activeChurners > 0 && (
                <div className="rounded-xl bg-red-950/30 border border-red-800/40 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                  ⚠️ <strong>{o.activeChurners}</strong> users have churn probability &gt; 70%
                </div>
              )}
            </div>
          )}

          {/* ── Acquisition ───────────────────────────────────────────── */}
          {tab === 'acquisition' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Signups (period)" value={dm.reduce((s, d) => s + d.new_signups, 0)} icon="✨" />
                <MetricCard label="Organic"          value={dm.reduce((s, d) => s + d.signups_organic, 0)} icon="🌱" />
                <MetricCard label="Referral"         value={dm.reduce((s, d) => s + d.signups_referral, 0)} icon="🤝" />
                <MetricCard label="Paid"             value={dm.reduce((s, d) => s + d.signups_paid, 0)} icon="📢" />
              </div>

              <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
                <h3 className="font-semibold text-white mb-4">Signup Funnel</h3>
                <FunnelChart steps={funnel.data ?? []} loading={funnel.loading} />
              </div>
            </div>
          )}

          {/* ── Engagement ────────────────────────────────────────────── */}
          {tab === 'engagement' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Avg session (s)"
                  value={dm.length ? fmt(dm.reduce((s, d) => s + (d.avg_session_seconds ?? 0), 0) / dm.length, 0) : '—'}
                  icon="⏱️"
                />
                <MetricCard
                  label="Total swipes"
                  value={fmt(dm.reduce((s, d) => s + d.total_swipes, 0))}
                  icon="👈"
                />
                <MetricCard
                  label="Swipe right rate"
                  value={o ? pct(o.swipeRightRate) : '—'}
                  icon="💜"
                />
                <MetricCard
                  label="Messages sent"
                  value={fmt(dm.reduce((s, d) => s + d.messages_sent, 0))}
                  icon="💬"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard label="Matches"           value={fmt(dm.reduce((s, d) => s + d.total_matches, 0))} icon="💞" />
                <MetricCard label="Conversations"     value={fmt(dm.reduce((s, d) => s + d.conversations_started, 0))} icon="🗣️" />
                <MetricCard label="Video calls"       value={fmt(dm.reduce((s, d) => s + d.video_calls_started, 0))} icon="📹" />
              </div>
            </div>
          )}

          {/* ── Retention ─────────────────────────────────────────────── */}
          {tab === 'retention' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="D1 Retention"  value={o ? pct(o.d1) : '—'}  icon="1️⃣" sub="Day 1 return rate" />
                <MetricCard label="D7 Retention"  value={o ? pct(o.d7) : '—'}  icon="7️⃣" sub="Week 1 return rate" />
                <MetricCard label="D30 Retention" value={o ? pct(o.d30) : '—'} icon="📅" sub="Month 1 return rate" />
              </div>

              <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 overflow-x-auto">
                <h3 className="font-semibold text-white mb-4">Weekly Cohort Retention</h3>
                <CohortGrid cohorts={cohorts.data ?? []} loading={cohorts.loading} />
              </div>

              {o && (
                <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
                  <p className="font-medium text-white text-sm mb-3">Churn Risk</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-neutral-400">High risk (&gt;70%)</span>
                      <span className="font-bold text-white">{o.activeChurners}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Monetization ──────────────────────────────────────────── */}
          {tab === 'monetization' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="MRR"                value={usd(totalMrr)} icon="💰" highlight />
                <MetricCard label="ARPU"               value={o ? usd(o.arpu) : '—'} icon="👤" />
                <MetricCard label="Conversion Rate"    value={o ? pct(o.conversionRate) : '—'} icon="⬆️" />
                <MetricCard label="New Subs (period)"  value={dm.reduce((s, d) => s + d.new_subscriptions, 0)} icon="🌟" />
              </div>

              {/* Revenue by plan */}
              {revenue.data && (
                <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
                  <h3 className="font-semibold text-white mb-4">Revenue by Plan</h3>
                  <div className="flex flex-col gap-3">
                    {revenue.data.filter(r => r.plan !== 'free').map(r => {
                      const pctOfMrr = totalMrr > 0 ? Math.round((r.mrr / totalMrr) * 100) : 0;
                      return (
                        <div key={r.plan} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize font-medium text-white">Qalbi {r.plan}</span>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-neutral-400">{r.active} active</span>
                              <span className="text-red-400">{r.cancelled} cancelled</span>
                              <span className="font-bold text-green-400">{usd(r.mrr)}/mo</span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-neutral-800">
                            <div
                              className={r.plan === 'gold' ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-purple-500'}
                              style={{ width: `${pctOfMrr}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Revenue trend */}
              {revSpark.length > 1 && (
                <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
                  <h3 className="font-semibold text-white mb-4">Daily Revenue ({range}d)</h3>
                  <SparkLine data={revSpark} color="#22c55e" fillColor="#22c55e" width={600} height={80} />
                  <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
                    <span>{dm[0]?.date}</span>
                    <span>{dm[dm.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
