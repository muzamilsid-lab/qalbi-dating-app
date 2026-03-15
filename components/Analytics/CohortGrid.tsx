'use client';

import clsx from 'clsx';
import type { CohortRow } from '@/lib/analytics/types';

interface Props {
  cohorts:  CohortRow[];
  loading?: boolean;
}

function rateColor(rate: number): string {
  if (rate >= 0.50) return 'bg-green-600 text-white';
  if (rate >= 0.35) return 'bg-green-800 text-green-300';
  if (rate >= 0.20) return 'bg-amber-900 text-amber-300';
  if (rate >= 0.10) return 'bg-red-900 text-red-300';
  return 'bg-neutral-800 text-neutral-500';
}

const MAX_PERIODS = 12;

export function CohortGrid({ cohorts, loading }: Props) {
  if (loading) {
    return <div className="h-64 bg-neutral-900 rounded-2xl animate-pulse" />;
  }
  if (!cohorts.length) {
    return <p className="text-neutral-500 text-sm text-center py-8">No cohort data yet</p>;
  }

  const periods = Array.from({ length: MAX_PERIODS }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-neutral-500 pb-2 pr-3 font-medium whitespace-nowrap">
              Cohort Week
            </th>
            <th className="text-neutral-500 pb-2 px-1 font-medium">Size</th>
            {periods.map(p => (
              <th key={p} className="text-neutral-500 pb-2 px-1 font-medium text-center">
                W{p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(cohort => {
            const rateMap = new Map(cohort.periods.map(p => [p.period, p.rate]));

            return (
              <tr key={cohort.cohort_week} className="border-t border-neutral-800">
                <td className="py-1.5 pr-3 text-neutral-300 whitespace-nowrap font-medium">
                  {cohort.cohort_week}
                </td>
                <td className="py-1.5 px-1 text-center text-neutral-400 font-mono">
                  {cohort.cohort_size.toLocaleString()}
                </td>
                {periods.map(p => {
                  const rate = rateMap.get(p);
                  return (
                    <td key={p} className="py-1.5 px-0.5">
                      {rate !== undefined ? (
                        <div className={clsx(
                          'rounded-md text-center py-1 px-1 font-mono font-bold text-xs leading-none',
                          rateColor(rate),
                        )}>
                          {(rate * 100).toFixed(0)}%
                        </div>
                      ) : (
                        <div className="rounded-md bg-neutral-900 py-1 px-1 text-center text-neutral-700">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 justify-end">
        {[
          { label: '≥50%', cls: 'bg-green-600' },
          { label: '35–50%', cls: 'bg-green-800' },
          { label: '20–35%', cls: 'bg-amber-900' },
          { label: '10–20%', cls: 'bg-red-900' },
          { label: '<10%', cls: 'bg-neutral-800' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${l.cls}`} />
            <span className="text-xs text-neutral-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
