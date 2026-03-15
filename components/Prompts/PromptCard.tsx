'use client';

import { motion } from 'framer-motion';
import { clsx }   from 'clsx';
import { ProfilePrompt, CATEGORY_META } from './types';

// ─── Swipeable card variant (used in discovery) ───────────────────────────────

interface SwipeVariantProps {
  prompt: ProfilePrompt;
  /** Expose to parent for A/B tracking */
  onView?: () => void;
  className?: string;
}

export function PromptCardSwipe({ prompt, onView, className }: SwipeVariantProps) {
  const meta = CATEGORY_META[prompt.prompt.category];

  return (
    <motion.div
      className={clsx(
        'relative w-full rounded-3xl overflow-hidden select-none',
        'border border-white/10 shadow-lg',
        className,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      onViewportEnter={onView}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.color} opacity-90`} />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      <div className="relative px-5 py-6 flex flex-col gap-3">
        {/* Category badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg" aria-hidden>{meta.icon}</span>
          <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
            {meta.label}
          </span>
        </div>

        {/* Prompt question */}
        <p className="text-white/80 text-sm font-medium leading-snug">
          {prompt.prompt.text}
        </p>

        {/* Answer */}
        <p className="text-white text-lg font-bold leading-snug">
          {prompt.answer}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Compact profile card (used in profile page between photos) ───────────────

interface ProfileVariantProps {
  prompt: ProfilePrompt;
  /** Callback when viewer taps the heart / like button */
  onLike?: () => void;
  onView?: () => void;
  className?: string;
}

export function PromptCard({ prompt, onLike, onView, className }: ProfileVariantProps) {
  const meta = CATEGORY_META[prompt.prompt.category];

  return (
    <motion.div
      className={clsx(
        'group relative rounded-2xl overflow-hidden cursor-default',
        'bg-[var(--color-surface)] border border-[var(--color-border)]',
        'shadow-sm hover:shadow-md transition-shadow',
        className,
      )}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onViewportEnter={onView}
    >
      {/* Category accent strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${meta.color}`} />

      <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
        {/* Category label */}
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>{meta.icon}</span>
          <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">
            {meta.label}
          </span>
        </div>

        {/* Question */}
        <p className="text-[var(--color-text-secondary)] text-sm">
          {prompt.prompt.text}
        </p>

        {/* Answer */}
        <p className="text-[var(--color-text-primary)] text-base font-semibold leading-snug">
          {prompt.answer}
        </p>
      </div>

      {/* Like button (slides in on hover) */}
      {onLike && (
        <motion.button
          className={clsx(
            'absolute bottom-3 right-3',
            'w-9 h-9 rounded-full flex items-center justify-center',
            `bg-gradient-to-br ${meta.color}`,
            'text-white shadow-md',
            'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100',
            'transition-all duration-200',
          )}
          whileTap={{ scale: 0.88 }}
          onClick={onLike}
          aria-label="Like this prompt"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                     2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09
                     3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0
                     3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </motion.button>
      )}
    </motion.div>
  );
}
