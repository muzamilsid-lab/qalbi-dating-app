'use client';

import { useState, useCallback }   from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx                        from 'clsx';
import { useBlock }                from '@/lib/safety/hooks/useBlock';

// ─── Options ─────────────────────────────────────────────────────────────────

type SheetAction = 'unmatch' | 'block' | 'block_and_report';

interface Option {
  action:      SheetAction;
  label:       string;
  description: string;
  icon:        string;
  danger?:     boolean;
}

const OPTIONS: Option[] = [
  {
    action:      'unmatch',
    label:       'Unmatch',
    description: 'Remove this match. They won\'t be notified.',
    icon:        '💔',
  },
  {
    action:      'block',
    label:       'Block',
    description: 'Block this person. You won\'t see each other.',
    icon:        '🚫',
    danger:      true,
  },
  {
    action:      'block_and_report',
    label:       'Block & Report',
    description: 'Block and send a report to our safety team.',
    icon:        '⛔',
    danger:      true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open:           boolean;
  onClose:        () => void;
  partnerName:    string;
  partnerId:      string;
  conversationId?: string;
  onReportOpen?:  () => void;
  onDone?:        () => void;
}

export function BlockUnmatchSheet({
  open, onClose, partnerName, partnerId, conversationId, onReportOpen, onDone,
}: Props) {
  const { blocking, unmatching, block, unmatch } = useBlock();
  const [confirming, setConfirming] = useState<SheetAction | null>(null);

  const handleSelect = useCallback((action: SheetAction) => {
    setConfirming(action);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirming) return;

    if (confirming === 'unmatch' && conversationId) {
      await unmatch(conversationId);
    } else if (confirming === 'block' || confirming === 'block_and_report') {
      await block(partnerId);
      if (confirming === 'block_and_report') {
        onClose();
        onReportOpen?.();
        return;
      }
    }

    onDone?.();
    onClose();
  }, [confirming, partnerId, conversationId, block, unmatch, onClose, onReportOpen, onDone]);

  const isLoading = blocking || unmatching;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-neutral-950 border-t border-neutral-800 px-5 pb-10 pt-5"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-neutral-700" />

            {confirming ? (
              /* ── Confirm step ──────────────────────────────────────────── */
              <div className="flex flex-col gap-5">
                <button
                  onClick={() => setConfirming(null)}
                  className="self-start text-neutral-400 hover:text-white text-sm flex items-center gap-1"
                >
                  ← Back
                </button>

                <div className="text-center">
                  <p className="text-4xl mb-3">
                    {OPTIONS.find(o => o.action === confirming)?.icon}
                  </p>
                  <p className="font-bold text-white text-lg">
                    {confirming === 'unmatch' ? 'Unmatch' : 'Block'} {partnerName}?
                  </p>
                  <p className="text-neutral-400 text-sm mt-1">
                    {confirming === 'block' || confirming === 'block_and_report'
                      ? `${partnerName} won't be able to see your profile or contact you.`
                      : `You'll both be removed from each other's matches. No notification is sent.`}
                  </p>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={clsx(
                    'w-full py-3.5 rounded-2xl font-semibold text-white transition-opacity',
                    confirming === 'unmatch' ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-red-700 hover:bg-red-600',
                    isLoading && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {isLoading ? 'Processing…' : `Confirm ${confirming === 'unmatch' ? 'Unmatch' : 'Block'}`}
                </button>

                <button onClick={onClose} className="text-center text-neutral-500 text-sm hover:text-white">
                  Cancel
                </button>
              </div>
            ) : (
              /* ── Option selection ──────────────────────────────────────── */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white text-lg">{partnerName}</h2>
                  <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl">✕</button>
                </div>

                <div className="flex flex-col gap-2">
                  {OPTIONS.map(opt => (
                    !conversationId && opt.action === 'unmatch' ? null : (
                      <button
                        key={opt.action}
                        onClick={() => handleSelect(opt.action)}
                        className={clsx(
                          'flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-colors',
                          opt.danger
                            ? 'border-red-800/40 bg-red-950/20 hover:bg-red-950/40'
                            : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600',
                        )}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                          <p className={clsx('font-semibold text-sm', opt.danger ? 'text-red-400' : 'text-white')}>
                            {opt.label}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">{opt.description}</p>
                        </div>
                      </button>
                    )
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
