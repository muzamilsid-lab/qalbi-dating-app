'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { clsx }                           from 'clsx';
import { Prompt, PromptCategory, CATEGORY_META } from './types';

interface Props {
  catalogue:   Prompt[];
  /** Prompt IDs already in use (prevent double-picking) */
  usedIds:     Set<number>;
  onSelect:    (prompt: Prompt) => void;
  onClose:     () => void;
}

const CATEGORY_ORDER: PromptCategory[] = [
  'about_me', 'lifestyle', 'dating', 'humor', 'culture', 'values',
];

export function PromptSelector({ catalogue, usedIds, onSelect, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('about_me');
  const [search, setSearch]                 = useState('');

  const filtered = useMemo(() => {
    const base = catalogue.filter(p =>
      p.category === activeCategory && !usedIds.has(p.id)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(p => p.text.toLowerCase().includes(q));
  }, [catalogue, activeCategory, usedIds, search]);

  const handleSelect = useCallback((p: Prompt) => {
    onSelect(p);
  }, [onSelect]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)]"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      role="dialog"
      aria-modal
      aria-label="Select a prompt"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe-top pt-5 pb-4 border-b border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-alt)] transition-colors"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h1 className="text-[var(--color-text-primary)] font-bold text-lg">
          Choose a Prompt
        </h1>
        <div className="w-9" aria-hidden />
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Search prompts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-rose-400 transition-colors"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
        {CATEGORY_ORDER.map(cat => {
          const m = CATEGORY_META[cat];
          const active = cat === activeCategory;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                active
                  ? `bg-gradient-to-r ${m.color} text-white`
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
              aria-pressed={active}
            >
              <span aria-hidden>{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + search}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-2 pt-2"
          >
            {filtered.length === 0 ? (
              <p className="text-center text-[var(--color-text-muted)] text-sm py-12">
                No prompts found
              </p>
            ) : (
              filtered.map(prompt => (
                <motion.button
                  key={prompt.id}
                  className={clsx(
                    'text-left w-full px-4 py-4 rounded-2xl',
                    'bg-[var(--color-surface-alt)] border border-[var(--color-border)]',
                    'hover:border-rose-400 hover:shadow-sm',
                    'transition-all duration-150',
                  )}
                  onClick={() => handleSelect(prompt)}
                  whileTap={{ scale: 0.98 }}
                >
                  <p className="text-[var(--color-text-primary)] font-medium leading-snug">
                    {prompt.text}
                  </p>
                  <span className="mt-1 inline-block text-rose-400 text-xs font-semibold">
                    Tap to answer →
                  </span>
                </motion.button>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
