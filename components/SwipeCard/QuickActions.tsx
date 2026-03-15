'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface Action {
  id: string;
  label: string;
  icon: string;
  variant?: 'default' | 'danger';
  onClick: () => void;
}

interface Props {
  open: boolean;
  profileName: string;
  onClose: () => void;
  onReport: () => void;
  onHide: () => void;
  onBlock: () => void;
}

export function QuickActions({ open, profileName, onClose, onReport, onHide, onBlock }: Props) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap & close on Escape
  useEffect(() => {
    if (!open) return;
    firstButtonRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const actions: Action[] = [
    {
      id: 'report',
      label: 'Report profile',
      icon: '🚩',
      variant: 'danger',
      onClick: () => { onReport(); onClose(); },
    },
    {
      id: 'hide',
      label: `Hide ${profileName}`,
      icon: '👁‍🗨',
      onClick: () => { onHide(); onClose(); },
    },
    {
      id: 'block',
      label: 'Block',
      icon: '🚫',
      variant: 'danger',
      onClick: () => { onBlock(); onClose(); },
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-[var(--color-surface)] rounded-t-3xl overflow-hidden pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            role="dialog"
            aria-modal="true"
            aria-label="Quick actions"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <p className="text-center text-[var(--color-text-muted)] text-sm px-5 py-2">
              {profileName}
            </p>

            <div className="flex flex-col gap-1 px-3 pb-3">
              {actions.map((action, i) => (
                <motion.button
                  key={action.id}
                  ref={i === 0 ? firstButtonRef : undefined}
                  onClick={action.onClick}
                  className={`
                    w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left
                    font-medium text-base transition-colors duration-150
                    ${action.variant === 'danger'
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]'
                    }
                  `}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-xl w-6 text-center" aria-hidden>{action.icon}</span>
                  {action.label}
                </motion.button>
              ))}

              {/* Cancel */}
              <motion.button
                onClick={onClose}
                className="w-full mt-1 px-4 py-4 rounded-2xl text-center font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
