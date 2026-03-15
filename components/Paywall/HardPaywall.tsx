'use client';

import { useState }     from 'react';
import { motion }       from 'framer-motion';
import { UpgradeModal } from './UpgradeModal';

// ─── Hard Paywall ─────────────────────────────────────────────────────────────
// Used inline to block a specific feature with a lock icon + benefit explanation.

interface Props {
  feature:     string;             // e.g. "Incognito Mode"
  benefit:     string;             // one-line benefit description
  plan?:       'plus' | 'gold';   // minimum required plan
  icon?:       string;             // emoji or icon component
  headline?:   string;
}

export function HardPaywall({ feature, benefit, plan = 'plus', icon = '🔒', headline }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const planLabel = plan === 'gold' ? 'Qalbi Gold' : 'Qalbi Plus';
  const gradient  = plan === 'gold'
    ? 'from-amber-500 to-orange-500'
    : 'from-purple-500 to-violet-600';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden"
      >
        {/* Top accent strip */}
        <div className={`h-1 bg-gradient-to-r ${gradient}`} />

        <div className="p-6 flex flex-col items-center text-center gap-4">
          {/* Lock icon */}
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg`}>
            {icon}
          </div>

          {/* Text */}
          <div>
            <p className="font-bold text-white text-lg">
              {headline ?? feature}
            </p>
            <p className="mt-1 text-sm text-neutral-400 leading-relaxed">
              {benefit}
            </p>
          </div>

          {/* Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${gradient} text-white`}>
            {planLabel} feature
          </span>

          {/* CTA */}
          <button
            onClick={() => setShowUpgrade(true)}
            className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient} hover:opacity-90 transition-opacity`}
          >
            Unlock {feature}
          </button>
        </div>
      </motion.div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        headline={`Unlock ${feature}`}
        subheading={benefit}
      />
    </>
  );
}
