'use client';

import { useEffect, useState } from 'react';

interface Stats {
  queue:             { pending: number; approved: number; rejected: number };
  reports:           number;
  activeSuspensions: number;
  reviewedToday:     number;
}

interface StatCardProps {
  label:   string;
  value:   number;
  color:   string;
  icon:    string;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex items-center gap-3`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function ModerationStats() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/moderation/stats');
      if (!res.ok) { setError('Failed to load stats'); return; }
      setStats(await res.json());
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!stats) return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 border border-neutral-800 bg-neutral-900 animate-pulse h-20" />
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <StatCard
        label="Pending Review"
        value={stats.queue.pending}
        color={stats.queue.pending > 20 ? 'border-red-500/40 bg-red-950/30' : 'border-amber-500/40 bg-amber-950/20'}
        icon="⏳"
      />
      <StatCard
        label="Approved Today"
        value={stats.queue.approved}
        color="border-green-500/40 bg-green-950/20"
        icon="✅"
      />
      <StatCard
        label="Rejected Today"
        value={stats.queue.rejected}
        color="border-red-500/40 bg-red-950/20"
        icon="🚫"
      />
      <StatCard
        label="Open Reports"
        value={stats.reports}
        color="border-purple-500/40 bg-purple-950/20"
        icon="🚩"
      />
      <StatCard
        label="You Reviewed"
        value={stats.reviewedToday ?? 0}
        color="border-blue-500/40 bg-blue-950/20"
        icon="👁️"
      />
    </div>
  );
}
