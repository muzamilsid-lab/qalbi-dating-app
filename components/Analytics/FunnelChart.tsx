'use client';

import { motion } from 'framer-motion';
import clsx       from 'clsx';
import type { FunnelStep } from '@/lib/analytics/types';

interface Props {
  steps:    FunnelStep[];
  loading?: boolean;
}

const STEP_COLORS = [
  'from-purple-600 to-violet-700',
  'from-violet-600 to-blue-700',
  'from-blue-600 to-cyan-700',
  'from-cyan-600 to-teal-700',
  'from-teal-600 to-green-700',
];

export function FunnelChart({ steps, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-neutral-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!steps.length) {
    return <p className="text-neutral-500 text-sm text-center py-8">No funnel data yet</p>;
  }

  const maxCount = steps[0]?.count || 1;

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => {
        const width = Math.max(20, (step.count / maxCount) * 100);

        return (
          <div key={step.step} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-neutral-400 font-medium">{step.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold font-mono">{step.count.toLocaleString()}</span>
                <span className="text-neutral-500 w-10 text-right">{step.pct_of_top}%</span>
              </div>
            </div>

            <div className="relative h-10 bg-neutral-800 rounded-xl overflow-hidden">
              <motion.div
                className={`h-full rounded-xl bg-gradient-to-r ${STEP_COLORS[i] ?? STEP_COLORS[4]}`}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            {i < steps.length - 1 && step.drop_off !== undefined && step.drop_off > 0 && (
              <p className="text-xs text-red-400 pl-1">
                ↓ {step.drop_off}% drop-off
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
