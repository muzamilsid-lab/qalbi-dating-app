'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx                       from 'clsx';
import { REPORT_REASON_LABELS }   from '@/lib/moderation/types';
import type { ReportReason }      from '@/lib/moderation/types';

// ─── Reason icons ─────────────────────────────────────────────────────────────

const REASON_ICONS: Record<ReportReason, string> = {
  fake_profile:         '🎭',
  inappropriate_photos: '📸',
  harassment:           '⚠️',
  underage:             '🔞',
  spam:                 '📢',
  other:                '📝',
};

// Reasons that unlock the free-text detail field
const DETAIL_REASONS = new Set<ReportReason>(['harassment', 'other', 'fake_profile']);

type Step = 'reason' | 'details' | 'confirm' | 'done';

interface Props {
  open:           boolean;
  reportedUserId: string;
  reportedName:   string;
  onClose:        () => void;
}

export function ReportSheet({ open, reportedUserId, reportedName, onClose }: Props) {
  const [step, setStep]     = useState<Step>('reason');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('reason');
    setReason(null);
    setDetails('');
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(reset, 300);
  }, [onClose, reset]);

  const selectReason = useCallback((r: ReportReason) => {
    setReason(r);
    setStep(DETAIL_REASONS.has(r) ? 'details' : 'confirm');
  }, []);

  const submit = useCallback(async () => {
    if (!reason) return;
    setLoading(true);
    setError(null);

    const res = await fetch('/api/report', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        reportedUserId,
        reason,
        details: details.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'Unknown error' }));
      setError(msg);
      return;
    }

    setStep('done');
  }, [reason, details, reportedUserId]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-neutral-950 border-t border-neutral-800 px-5 pb-10 pt-5 max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />

            {/* ── Step: reason selection ─────────────────────────────────────── */}
            {step === 'reason' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white text-lg">Report {reportedName}</h2>
                  <button onClick={handleClose} className="text-neutral-500 hover:text-white text-xl">✕</button>
                </div>
                <p className="text-sm text-neutral-400">
                  Choose the reason for your report. We review all reports carefully.
                </p>

                <div className="flex flex-col gap-2">
                  {(Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][]).map(([r, label]) => (
                    <button
                      key={r}
                      onClick={() => selectReason(r)}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors',
                        r === 'underage'
                          ? 'border-red-700/50 bg-red-950/30 hover:bg-red-950/50'
                          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600',
                      )}
                    >
                      <span className="text-xl">{REASON_ICONS[r]}</span>
                      <span className="text-sm font-medium text-white">{label}</span>
                      {r === 'underage' && (
                        <span className="ml-auto text-xs text-red-400 font-semibold">URGENT</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step: details ──────────────────────────────────────────────── */}
            {step === 'details' && reason && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('reason')} className="text-neutral-400 hover:text-white text-lg">←</button>
                  <h2 className="font-bold text-white text-lg">{REPORT_REASON_LABELS[reason]}</h2>
                </div>
                <p className="text-sm text-neutral-400">
                  Please describe what happened. More detail helps our moderation team act faster.
                </p>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value.slice(0, 1000))}
                  placeholder="Describe the issue…"
                  rows={4}
                  className="w-full rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm px-4 py-3 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500"
                />
                <p className="text-xs text-neutral-600 text-right">{details.length}/1000</p>
                <button
                  onClick={() => setStep('confirm')}
                  className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Step: confirm ─────────────────────────────────────────────── */}
            {step === 'confirm' && reason && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(DETAIL_REASONS.has(reason) ? 'details' : 'reason')} className="text-neutral-400 hover:text-white text-lg">←</button>
                  <h2 className="font-bold text-white text-lg">Confirm Report</h2>
                </div>

                <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{REASON_ICONS[reason]}</span>
                    <span className="font-medium text-white">{REPORT_REASON_LABELS[reason]}</span>
                  </div>
                  {details && (
                    <p className="text-neutral-400 text-xs leading-relaxed">"{details}"</p>
                  )}
                </div>

                {reason === 'underage' && (
                  <div className="rounded-xl bg-red-950 border border-red-700 p-3 text-xs text-red-300">
                    ⚠️ Underage reports are treated as urgent. The account will be suspended immediately pending review.
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}

                <button
                  onClick={submit}
                  disabled={loading}
                  className={clsx(
                    'w-full py-3 rounded-xl font-semibold text-white transition-colors',
                    reason === 'underage'
                      ? 'bg-red-700 hover:bg-red-600'
                      : 'bg-purple-600 hover:bg-purple-500',
                    loading && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {loading ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            )}

            {/* ── Step: done ────────────────────────────────────────────────── */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="text-6xl"
                >
                  ✅
                </motion.div>
                <div>
                  <p className="font-bold text-white text-lg">Report submitted</p>
                  <p className="text-neutral-400 text-sm mt-1">
                    We'll review this report carefully. Thank you for helping keep Qalbi safe.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="px-8 py-3 rounded-xl bg-neutral-800 text-white font-medium hover:bg-neutral-700 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
