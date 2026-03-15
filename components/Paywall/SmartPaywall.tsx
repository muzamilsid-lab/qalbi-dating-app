'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion }                  from 'framer-motion';
import { UpgradeModal }                             from './UpgradeModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const PASS_THRESHOLD     = 5;    // show paywall after this many consecutive passes
const STORAGE_KEY        = 'qalbi_consecutive_passes';
const SESSION_SHOWN_KEY  = 'qalbi_smart_paywall_shown';

// ─── Smart Paywall ────────────────────────────────────────────────────────────
//
// Renders a nudge overlay after the user passes on PASS_THRESHOLD profiles in
// a row without liking anyone. Shows once per session maximum.
//
// Usage: wrap your swipe screen and call onPass() / onLike() from swipe handlers.

interface Props {
  /** Called to get the current consecutive pass count — provided by parent */
  getPassCount: () => number;
  /** Notify this component after every swipe so it re-evaluates */
  registerSetter: (setter: (n: number) => void) => void;
}

export function SmartPaywall({ getPassCount, registerSetter }: Props) {
  const [passCount, setPassCount]     = useState(getPassCount);
  const [showNudge, setShowNudge]     = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const shownThisSession              = useRef(false);

  // Register our setter with the parent so it can update us on swipe
  useEffect(() => { registerSetter(setPassCount); }, [registerSetter]);

  // Evaluate after each pass count change
  useEffect(() => {
    if (
      passCount >= PASS_THRESHOLD &&
      !shownThisSession.current &&
      typeof window !== 'undefined' &&
      !sessionStorage.getItem(SESSION_SHOWN_KEY)
    ) {
      shownThisSession.current = true;
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      // Small delay so it appears after the swipe animation settles
      const t = setTimeout(() => setShowNudge(true), 400);
      return () => clearTimeout(t);
    }
  }, [passCount]);

  const dismiss = useCallback(() => setShowNudge(false), []);

  return (
    <>
      <AnimatePresence>
        {showNudge && !showUpgrade && (
          <motion.div
            key="nudge"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-28 inset-x-4 z-40 rounded-2xl bg-neutral-900 border border-purple-500/40 shadow-2xl overflow-hidden"
          >
            {/* Accent */}
            <div className="h-1 bg-gradient-to-r from-purple-500 to-violet-600" />

            <div className="p-5 flex gap-4 items-start">
              {/* Icon */}
              <div className="text-3xl mt-0.5 shrink-0">💜</div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm leading-snug">
                  See who already likes you
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  You've passed on {PASS_THRESHOLD} profiles. Matches are waiting — upgrade to skip the guessing.
                </p>
              </div>

              {/* Close */}
              <button
                onClick={dismiss}
                className="text-neutral-600 hover:text-white text-lg leading-none shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Buttons */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => { dismiss(); setShowUpgrade(true); }}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors"
              >
                See Who Likes Me
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-400 text-sm hover:text-white transition-colors"
              >
                Keep swiping
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        headline="Skip the guessing game"
        subheading="See exactly who already likes you and match instantly."
      />
    </>
  );
}

// ─── Hook to wire SmartPaywall into a swipe screen ───────────────────────────

export function useSmartPaywallTracker() {
  const countRef   = useRef(0);
  const setterRef  = useRef<((n: number) => void) | null>(null);

  const getPassCount = useCallback(() => countRef.current, []);

  const registerSetter = useCallback((setter: (n: number) => void) => {
    setterRef.current = setter;
  }, []);

  const onPass = useCallback(() => {
    countRef.current += 1;
    setterRef.current?.(countRef.current);
  }, []);

  const onLike = useCallback(() => {
    // Reset streak on a like
    countRef.current = 0;
    setterRef.current?.(0);
  }, []);

  return { getPassCount, registerSetter, onPass, onLike };
}
