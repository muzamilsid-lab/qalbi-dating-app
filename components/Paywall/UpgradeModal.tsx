'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PricingCard }            from './PricingCard';
import { useSubscription }        from '@/lib/stripe/hooks/useSubscription';
import { PLANS, BillingInterval } from '@/lib/stripe/types';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open:     boolean;
  onClose:  () => void;
  /** Optional heading override for contextual paywalls */
  headline?: string;
  subheading?: string;
}

export function UpgradeModal({ open, onClose, headline, subheading }: Props) {
  const { plan: currentPlan, startCheckout } = useSubscription();
  const [interval, setInterval]              = useState<BillingInterval>('yearly');
  const [loadingKey, setLoadingKey]          = useState<string | null>(null);

  const handleSelect = useCallback(async (priceEnvKey: string) => {
    setLoadingKey(priceEnvKey);
    try {
      await startCheckout(priceEnvKey);
    } catch (err: any) {
      alert(err.message ?? 'Something went wrong');
      setLoadingKey(null);
    }
  }, [startCheckout]);

  const filteredPlans = PLANS.filter(p => p.interval === interval);

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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0,      opacity: 1 }}
            exit={{ y: '100%',    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-neutral-950 px-5 pb-10 pt-6"
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-neutral-700" />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute right-5 top-6 text-neutral-500 hover:text-white text-xl leading-none"
            >
              ✕
            </button>

            {/* Headline */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {headline ?? 'Upgrade to Qalbi Premium'}
              </h2>
              {subheading && (
                <p className="mt-1 text-sm text-neutral-400">{subheading}</p>
              )}
            </div>

            {/* Billing toggle */}
            <div className="flex justify-center mb-6">
              <div className="flex gap-1 rounded-full bg-neutral-800 p-1">
                {(['monthly', 'yearly'] as BillingInterval[]).map(iv => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    className={[
                      'px-5 py-1.5 rounded-full text-sm font-medium transition-colors',
                      interval === iv
                        ? 'bg-purple-600 text-white'
                        : 'text-neutral-400 hover:text-white',
                    ].join(' ')}
                  >
                    {iv === 'monthly' ? 'Monthly' : 'Yearly'}
                    {iv === 'yearly' && (
                      <span className="ml-1.5 text-xs text-purple-300">Save 33%+</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl mx-auto">
              {filteredPlans.map(plan => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={currentPlan === plan.plan}
                  onSelect={handleSelect}
                  loading={loadingKey === plan.id}
                />
              ))}
            </div>

            {/* Fine print */}
            <p className="mt-6 text-center text-xs text-neutral-600">
              Subscriptions renew automatically. Cancel anytime.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
