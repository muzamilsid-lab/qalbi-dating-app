'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { MatchAnimation } from './MatchAnimation';
import { SwipeCard } from './SwipeCard';
import { usePreloader } from './hooks/usePreloader';
import { SwipeDeckProps, SwipeResult } from './types';

const DEFAULT_STACK_DEPTH = 3;

export function SwipeDeck({
  profiles,
  onSwipe,
  onEmpty,
  currentUserPhoto,
  stackDepth = DEFAULT_STACK_DEPTH,
}: SwipeDeckProps) {
  const [topIndex, setTopIndex] = useState(0);
  const [matchProfile, setMatchProfile] = useState<typeof profiles[0] | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  // Pre-load next cards' photos
  usePreloader(profiles, topIndex);

  const handleSwipe = useCallback(
    (result: SwipeResult) => {
      onSwipe(result);

      const next = topIndex + 1;

      // Check for match (in real app, this comes from server response)
      // Simulate: every "right" swipe has a 30% chance of being a match
      if (result.direction === 'right' || result.direction === 'super') {
        const isMatch = Math.random() < 0.3;
        if (isMatch) {
          setMatchProfile(profiles[topIndex]);
          setShowMatch(true);
          setTopIndex(next);
          return;
        }
      }

      setTopIndex(next);

      if (next >= profiles.length) {
        onEmpty?.();
      }
    },
    [topIndex, profiles, onSwipe, onEmpty]
  );

  const visibleProfiles = profiles.slice(topIndex, topIndex + stackDepth + 1);

  return (
    <>
      <div
        className="relative w-full"
        style={{ height: 'calc(100svh - 160px)' }}
        aria-label="Profile discovery"
        aria-live="polite"
      >
        {visibleProfiles.length > 0 ? (
          <AnimatePresence>
            {/* Render in reverse so top card is visually on top */}
            {[...visibleProfiles].reverse().map((profile, reversedIndex) => {
              const stackIndex = visibleProfiles.length - 1 - reversedIndex;
              return (
                <SwipeCard
                  key={profile.id}
                  profile={profile}
                  stackIndex={stackIndex}
                  onSwipe={handleSwipe}
                  currentUserPhoto={currentUserPhoto}
                />
              );
            })}
          </AnimatePresence>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Match celebration overlay */}
      <MatchAnimation
        visible={showMatch}
        profileName={matchProfile?.name ?? ''}
        profilePhoto={matchProfile?.photos[0]}
        currentUserPhoto={currentUserPhoto}
        onKeepSwiping={() => setShowMatch(false)}
        onMessage={() => {
          setShowMatch(false);
          // Navigate to chat — handled by parent
        }}
      />
    </>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <span className="text-6xl" aria-hidden>🌍</span>
      <h3 className="text-[var(--color-text-primary)] text-xl font-bold">
        You've seen everyone nearby
      </h3>
      <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
        Check back later — new people join every day.
        Try expanding your distance to see more.
      </p>
      <motion.button
        className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm shadow-lg"
        whileTap={{ scale: 0.97 }}
      >
        Expand Distance
      </motion.button>
    </motion.div>
  );
}
