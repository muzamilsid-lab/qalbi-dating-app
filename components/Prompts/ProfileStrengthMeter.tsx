'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState }                from 'react';
import { clsx }                    from 'clsx';
import { ProfileStrength }         from './types';

interface Props {
  strength: ProfileStrength;
  /** Show the expanded breakdown by default */
  defaultExpanded?: boolean;
}

const LEVEL_CONFIG = {
  starter:  { label: 'Starter',  color: 'from-slate-400  to-slate-500',   emoji: '🌱' },
  growing:  { label: 'Growing',  color: 'from-amber-400  to-orange-500',  emoji: '🌿' },
  strong:   { label: 'Strong',   color: 'from-emerald-400 to-teal-500',   emoji: '⚡' },
  complete: { label: 'Complete', color: 'from-rose-500    to-pink-500',    emoji: '✨' },
} as const;

export function ProfileStrengthMeter({ strength, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const level = LEVEL_CONFIG[strength.level];

  return (
    <div className="rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls="strength-breakdown"
      >
        <span className="text-2xl" aria-hidden>{level.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[var(--color-text-primary)] text-sm font-bold">
              Profile Strength
            </span>
            <span className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full text-white',
              `bg-gradient-to-r ${level.color}`,
            )}>
              {level.label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${level.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${strength.score}%` }}
              transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </div>
        </div>

        {/* Chevron */}
        <motion.svg
          viewBox="0 0 24 24"
          className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]"
          fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M6 9l6 6 6-6"/>
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="strength-breakdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-1.5">
              <div className="h-px bg-[var(--color-border)] mb-1" />

              {strength.factors.map(f => (
                <div key={f.key} className="flex items-center gap-2.5">
                  <div className={clsx(
                    'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                    f.done
                      ? 'bg-emerald-500'
                      : 'border-2 border-[var(--color-border)]',
                  )}>
                    {f.done && (
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </div>
                  <span className={clsx(
                    'text-sm',
                    f.done
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-muted)]',
                  )}>
                    {f.label}
                  </span>
                  {!f.done && (
                    <span className="ml-auto text-xs font-semibold text-rose-400">
                      +{f.points}pts
                    </span>
                  )}
                </div>
              ))}

              {/* Next suggestion */}
              {strength.nextSuggestion && (
                <div className={clsx(
                  'mt-2 px-3 py-2.5 rounded-xl',
                  'bg-rose-50 dark:bg-rose-950/30',
                  'border border-rose-200 dark:border-rose-800/40',
                )}>
                  <p className="text-rose-600 dark:text-rose-400 text-xs font-medium leading-snug">
                    💡 {strength.nextSuggestion}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
