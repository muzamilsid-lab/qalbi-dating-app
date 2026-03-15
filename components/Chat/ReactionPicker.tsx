'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { REACTION_EMOJIS, ReactionEmoji } from './types';

interface Props {
  open: boolean;
  /** "left" means the bubble is left-aligned (theirs) */
  align: 'left' | 'right';
  onSelect: (emoji: ReactionEmoji) => void;
  onClose: () => void;
}

export function ReactionPicker({ open, align, onSelect, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dismiss layer */}
          <div
            className="fixed inset-0 z-30"
            onClick={onClose}
            aria-hidden
          />

          {/* Picker bubble */}
          <motion.div
            className={`
              absolute z-40 bottom-full mb-2
              ${align === 'left' ? 'left-0' : 'right-0'}
              flex items-center gap-1
              bg-[var(--color-surface)] rounded-full
              shadow-xl border border-[var(--color-border)]
              px-2 py-1.5
            `}
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            role="group"
            aria-label="React to message"
          >
            {REACTION_EMOJIS.map((emoji, i) => (
              <motion.button
                key={emoji}
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-[var(--color-surface-alt)] transition-colors"
                onClick={(e) => { e.stopPropagation(); onSelect(emoji); onClose(); }}
                aria-label={`React with ${emoji}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 25,
                  delay: i * 0.03,
                }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Reaction badge on bubble ─────────────────────────────────────────────────

interface BadgeProps {
  reactions: { emoji: string; count: number; userReacted: boolean }[];
  isMine: boolean;
  onBadgeTap: (emoji: string) => void;
}

export function ReactionBadges({ reactions, isMine, onBadgeTap }: BadgeProps) {
  const visible = reactions.filter(r => r.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? 'justify-end' : 'justify-start'}`}>
      {visible.map(r => (
        <motion.button
          key={r.emoji}
          className={`
            inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs
            border transition-colors
            ${r.userReacted
              ? 'bg-rose-100 border-rose-300 dark:bg-rose-900/40 dark:border-rose-700'
              : 'bg-[var(--color-surface-alt)] border-[var(--color-border)]'
            }
            hover:scale-105 active:scale-95
          `}
          onClick={() => onBadgeTap(r.emoji)}
          aria-label={`${r.emoji} reaction, ${r.count} ${r.count === 1 ? 'person' : 'people'}${r.userReacted ? ', including you' : ''}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          layout
        >
          <span>{r.emoji}</span>
          {r.count > 1 && (
            <span className="text-[var(--color-text-muted)] font-medium">{r.count}</span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
