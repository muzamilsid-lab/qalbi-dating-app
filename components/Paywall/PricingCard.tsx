'use client';

import { motion } from 'framer-motion';
import clsx       from 'clsx';
import type { PlanConfig, SubscriptionPlan } from '@/lib/stripe/types';

// ─── Feature lists ────────────────────────────────────────────────────────────

const PLUS_FEATURES = [
  'See who likes you',
  'Undo last swipe',
  '50 likes per day',
  '1 Profile Boost / month',
  'Passport Mode',
];

const GOLD_FEATURES = [
  'Everything in Plus',
  'Unlimited likes',
  'Priority in discovery',
  'Read receipts in chat',
  'Advanced filters',
  'Gold profile highlight',
  'Incognito mode',
  '5 Profile Boosts / month',
  'Dedicated support',
];

const FEATURES: Record<SubscriptionPlan, string[]> = {
  free: [],
  plus: PLUS_FEATURES,
  gold: GOLD_FEATURES,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  plan:        PlanConfig;
  isCurrentPlan: boolean;
  onSelect:    (priceEnvKey: string) => void;
  loading?:    boolean;
}

export function PricingCard({ plan, isCurrentPlan, onSelect, loading }: Props) {
  const isGold     = plan.plan === 'gold';
  const isYearly   = plan.interval === 'yearly';
  const features   = FEATURES[plan.plan];

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={clsx(
        'relative rounded-2xl border p-6 flex flex-col gap-5',
        isGold
          ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 to-neutral-950'
          : 'border-purple-500/40 bg-gradient-to-b from-purple-950/40 to-neutral-950',
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className={clsx(
          'absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold',
          isGold ? 'bg-amber-400 text-black' : 'bg-purple-500 text-white',
        )}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-sm font-medium text-neutral-400">
          {plan.label}
        </p>
        <div className="mt-1 flex items-end gap-1">
          <span className="text-4xl font-bold text-white">
            ${plan.priceUsd}
          </span>
          <span className="text-neutral-400 mb-1 text-sm">
            /{plan.interval === 'monthly' ? 'mo' : 'yr'}
          </span>
        </div>
        {isYearly && (
          <p className={clsx(
            'text-xs mt-0.5',
            isGold ? 'text-amber-400' : 'text-purple-400',
          )}>
            ${plan.monthlyEquiv.toFixed(2)}/mo · billed annually
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-2 text-sm text-neutral-300 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <span className={isGold ? 'text-amber-400' : 'text-purple-400'}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        disabled={isCurrentPlan || loading}
        onClick={() => onSelect(plan.id)}
        className={clsx(
          'w-full py-3 rounded-xl font-semibold text-sm transition-opacity',
          isCurrentPlan
            ? 'bg-neutral-700 text-neutral-400 cursor-default'
            : isGold
              ? 'bg-amber-400 text-black hover:bg-amber-300'
              : 'bg-purple-600 text-white hover:bg-purple-500',
          loading && 'opacity-60 cursor-not-allowed',
        )}
      >
        {isCurrentPlan ? 'Current Plan' : loading ? 'Redirecting…' : `Get ${plan.label}`}
      </button>
    </motion.div>
  );
}
