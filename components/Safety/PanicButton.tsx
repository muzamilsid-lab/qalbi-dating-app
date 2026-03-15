'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion }          from 'framer-motion';
import { usePanicButton, type DisguiseTarget } from '@/lib/safety/hooks/usePanicButton';

// ─── Panic Button Component ───────────────────────────────────────────────────
// Renders an unobtrusive button in Settings and activates via shake gesture.

interface Props {
  disguise?: DisguiseTarget;
}

export function PanicButton({ disguise = 'calculator' }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { trigger } = usePanicButton({
    enabled:  true,
    disguise,
    onTrigger: () => setShowMenu(false),
  });

  // Countdown before activation (gives user chance to cancel if accidental)
  const startCountdown = useCallback(() => {
    setShowMenu(false);
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { trigger(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, trigger]);

  const DISGUISE_LABELS: Record<DisguiseTarget, string> = {
    calculator: '🔢 Open Calculator',
    notes:      '📝 Open Notes',
    weather:    '🌤️ Open Weather',
  };

  return (
    <>
      {/* Hidden panic button in settings — looks like a normal settings item */}
      <button
        onClick={() => setShowMenu(true)}
        className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-red-900/60 flex items-center justify-center text-sm">
          🆘
        </div>
        <div>
          <p className="font-medium text-white text-sm">Panic Button</p>
          <p className="text-xs text-neutral-500">Quick exit • Shake phone to activate</p>
        </div>
      </button>

      {/* Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              key="bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              key="panel"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{ scale: 0.9,    opacity: 0 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 rounded-3xl bg-neutral-950 border border-red-800/50 p-6 flex flex-col gap-5"
            >
              <div className="text-center">
                <p className="text-4xl mb-2">🆘</p>
                <p className="font-bold text-white text-lg">Quick Exit</p>
                <p className="text-neutral-400 text-sm mt-1">
                  Close Qalbi and open another app instantly.
                  Your session will be saved.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {(Object.entries(DISGUISE_LABELS) as [DisguiseTarget, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setShowMenu(false); window.location.replace(`/api/safety/disguise?app=${key}`); }}
                    className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowMenu(false)}
                className="text-center text-neutral-600 text-sm hover:text-neutral-400"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center flex-col gap-4"
          >
            <motion.p
              key={countdown}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              className="text-8xl font-bold text-white"
            >
              {countdown}
            </motion.p>
            <p className="text-neutral-400 text-sm">Closing Qalbi…</p>
            <button
              onClick={() => setCountdown(null)}
              className="mt-4 px-6 py-2 rounded-xl bg-neutral-800 text-white text-sm"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
