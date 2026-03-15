'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useRef }     from 'react';
import { clsx }                    from 'clsx';
import { Prompt, CATEGORY_META, MAX_ANSWER_LENGTH } from './types';

interface Props {
  prompt:    Prompt;
  answer:    string;
  onChange:  (answer: string) => void;
  onClose:   () => void;
  onSave:    () => void;
  saving?:   boolean;
  className?: string;
}

export function PromptEditor({ prompt, answer, onChange, onClose, onSave, saving, className }: Props) {
  const meta       = CATEGORY_META[prompt.category];
  const remaining  = MAX_ANSWER_LENGTH - answer.length;
  const isOverLimit = remaining < 0;
  const isEmpty    = answer.trim().length === 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [onChange]);

  // Close on backdrop click
  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleBackdrop}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Sheet */}
      <motion.div
        className={clsx(
          'relative z-10 w-full sm:max-w-lg',
          'bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl',
          'shadow-2xl',
          className,
        )}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0,      opacity: 1 }}
        exit={{ y: '100%',    opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={`Edit prompt: ${prompt.text}`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" aria-hidden />
        </div>

        <div className="px-5 pb-6 flex flex-col gap-4">
          {/* Category tag */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${meta.color}`}
            >
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </span>
          </div>

          {/* Prompt question */}
          <h2 className="text-[var(--color-text-primary)] text-xl font-bold leading-snug">
            {prompt.text}
          </h2>

          {/* Textarea */}
          <div className={clsx(
            'relative rounded-2xl border-2 transition-colors',
            isOverLimit
              ? 'border-red-400'
              : 'border-[var(--color-border)] focus-within:border-rose-400',
          )}>
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={handleChange}
              placeholder="Write your answer…"
              rows={3}
              autoFocus
              className={clsx(
                'w-full bg-transparent px-4 pt-3 pb-8 resize-none outline-none',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                'text-base leading-relaxed',
              )}
              style={{ minHeight: 100 }}
              aria-label="Answer"
              aria-describedby="char-count"
            />

            {/* Character counter */}
            <div
              id="char-count"
              className={clsx(
                'absolute bottom-2 right-3 text-xs font-medium tabular-nums',
                isOverLimit
                  ? 'text-red-400'
                  : remaining <= 30
                  ? 'text-amber-500'
                  : 'text-[var(--color-text-muted)]',
              )}
              aria-live="polite"
              aria-atomic
            >
              {remaining}
            </div>
          </div>

          {/* Over-limit warning */}
          <AnimatePresence>
            {isOverLimit && (
              <motion.p
                className="text-red-400 text-xs -mt-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                {Math.abs(remaining)} characters over the limit
              </motion.p>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold text-sm hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Cancel
            </button>
            <motion.button
              onClick={onSave}
              disabled={isEmpty || isOverLimit || saving}
              className={clsx(
                'flex-1 py-3 rounded-2xl font-bold text-sm text-white',
                `bg-gradient-to-r ${meta.color}`,
                'disabled:opacity-40 transition-opacity',
                'flex items-center justify-center gap-2',
              )}
              whileTap={{ scale: 0.97 }}
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {saving ? 'Saving…' : 'Save Answer'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
