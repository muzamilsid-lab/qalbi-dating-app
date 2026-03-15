'use client';

import { useState }        from 'react';
import { motion }          from 'framer-motion';
import { UpgradeModal }    from './UpgradeModal';

// ─── Soft Paywall ─────────────────────────────────────────────────────────────
// Used to show blurred "who liked you" profiles with a teaser CTA.

interface LikerPreview {
  id:          string;
  displayName: string;
  photoUrl:    string | null;
}

interface Props {
  likers:       LikerPreview[];
  totalCount:   number;
}

export function SoftPaywall({ likers, totalCount }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 p-5">
        {/* Blurred profile grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {likers.slice(0, 6).map((liker, i) => (
            <motion.div
              key={liker.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1,  scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="relative aspect-square rounded-xl overflow-hidden"
            >
              {liker.photoUrl ? (
                <img
                  src={liker.photoUrl}
                  alt=""
                  className="h-full w-full object-cover blur-[10px] scale-110"
                />
              ) : (
                <div className="h-full w-full bg-neutral-700 blur-[10px]" />
              )}
              {/* Heart overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl drop-shadow-lg">💜</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-neutral-900 to-transparent pointer-events-none" />

        {/* CTA */}
        <div className="relative text-center">
          <p className="font-semibold text-white text-lg mb-1">
            {totalCount} {totalCount === 1 ? 'person' : 'people'} liked you
          </p>
          <p className="text-sm text-neutral-400 mb-4">
            Upgrade to see who's interested
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-3 rounded-2xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-colors"
          >
            See Who Liked You
          </button>
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        headline="See who likes you"
        subheading="Upgrade to Qalbi Plus and match instantly with people who already like you."
      />
    </>
  );
}
