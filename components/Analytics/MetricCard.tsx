'use client';

import clsx from 'clsx';

interface Props {
  label:       string;
  value:       string | number;
  sub?:        string;
  trend?:      number;    // positive = good, negative = bad
  trendLabel?: string;
  icon?:       string;
  highlight?:  boolean;
}

export function MetricCard({ label, value, sub, trend, trendLabel, icon, highlight }: Props) {
  const trendUp      = trend !== undefined && trend > 0;
  const trendDown    = trend !== undefined && trend < 0;
  const trendNeutral = trend === 0 || trend === undefined;

  return (
    <div className={clsx(
      'rounded-2xl border p-4 flex flex-col gap-2',
      highlight
        ? 'border-purple-500/50 bg-purple-950/20'
        : 'border-neutral-800 bg-neutral-900',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>

      <p className="text-2xl font-bold text-white leading-none">{value}</p>

      {(sub || trend !== undefined) && (
        <div className="flex items-center justify-between">
          {sub && <p className="text-xs text-neutral-600">{sub}</p>}
          {trend !== undefined && (
            <span className={clsx(
              'text-xs font-medium',
              trendUp    ? 'text-green-400' :
              trendDown  ? 'text-red-400'   :
                           'text-neutral-500',
            )}>
              {trendUp ? '↑' : trendDown ? '↓' : '→'}
              {trendLabel ?? `${Math.abs(trend)}%`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
