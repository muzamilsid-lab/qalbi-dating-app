'use client';

import { AnimatePresence, motion, MotionValue, useTransform } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Gallery, PhotoCarousel } from './PhotoCarousel';
import { ProfileOverlay } from './ProfileOverlay';
import { QuickActions } from './QuickActions';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { SwipeCardProps, SwipeDirection } from './types';

const LONG_PRESS_DELAY = 600; // ms

// ─── Swipe badge overlay ──────────────────────────────────────────────────────

function SwipeBadge({
  opacity,
  label,
  color,
  rotate,
  position,
}: {
  opacity: MotionValue<number>;
  label: string;
  color: string;
  rotate: string;
  position: 'left' | 'right' | 'top';
}) {
  const posClass =
    position === 'left'  ? 'top-12 left-5'  :
    position === 'right' ? 'top-12 right-5' :
    'top-6 inset-x-0 flex justify-center';

  return (
    <motion.div
      className={clsx('absolute z-20 pointer-events-none', posClass)}
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className={clsx(
          'px-4 py-1.5 rounded-xl border-[3px] font-black text-2xl tracking-widest uppercase',
          color
        )}
        style={{ rotate }}
      >
        {label}
      </div>
    </motion.div>
  );
}

// ─── Action buttons (accessibility + keyboard alternative to swipe) ───────────

function ActionBar({
  onPass,
  onLike,
  onSuperLike,
  profileName,
}: {
  onPass: () => void;
  onLike: () => void;
  onSuperLike: () => void;
  profileName: string;
}) {
  return (
    <div
      className="absolute -bottom-20 inset-x-0 flex items-center justify-center gap-4"
      role="group"
      aria-label={`Actions for ${profileName}`}
    >
      {/* Pass */}
      <motion.button
        onClick={onPass}
        className="w-14 h-14 rounded-full bg-white dark:bg-[var(--color-surface)] shadow-lg border border-[var(--color-border)] flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform"
        whileTap={{ scale: 0.93 }}
        aria-label={`Pass on ${profileName}`}
      >
        ✕
      </motion.button>

      {/* Super Like */}
      <motion.button
        onClick={onSuperLike}
        className="w-12 h-12 rounded-full bg-white dark:bg-[var(--color-surface)] shadow-md border border-[var(--color-border)] flex items-center justify-center text-xl hover:scale-110 active:scale-95 transition-transform"
        whileTap={{ scale: 0.93 }}
        aria-label={`Super like ${profileName}`}
      >
        ⭐
      </motion.button>

      {/* Like */}
      <motion.button
        onClick={onLike}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform"
        whileTap={{ scale: 0.93 }}
        aria-label={`Like ${profileName}`}
      >
        ❤️
      </motion.button>
    </div>
  );
}

// ─── Main SwipeCard ───────────────────────────────────────────────────────────

export function SwipeCard({
  profile,
  stackIndex,
  onSwipe,
  className,
}: SwipeCardProps) {
  const [galleryOpen, setGalleryOpen]   = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [swiped, setSwiped] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSwipe = useCallback(
    (dir: SwipeDirection) => {
      setSwiped(true);
      onSwipe({ profileId: profile.id, direction: dir, timestamp: Date.now() });
    },
    [profile.id, onSwipe]
  );

  const {
    x, y, rotate,
    likeOpacity, nopeOpacity, superOpacity, cardOpacity,
    controls,
    handleDragEnd,
    handleTap,
    triggerSwipe,
  } = useSwipeGesture(handleSwipe);

  // ── Stack peek styling ─────────────────────────────────────────────────────
  const isTop        = stackIndex === 0;
  const peekScale    = 1 - stackIndex * 0.035;
  const peekY        = stackIndex * 14;
  const peekOpacity  = stackIndex >= 3 ? 0 : 1 - stackIndex * 0.15;

  // ── Long-press handlers ────────────────────────────────────────────────────
  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setQuickActionsOpen(true);
    }, LONG_PRESS_DELAY);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const openGallery = useCallback((index: number) => {
    setGalleryOpen(true);
    setGalleryStart(index);
  }, []);

  if (swiped) return null;
  if (stackIndex > 3) return null;

  return (
    <>
      <motion.article
        className={clsx(
          'absolute inset-0 rounded-3xl overflow-hidden',
          'bg-gray-200 dark:bg-gray-800',
          'touch-none select-none',
          isTop ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          'group',
          className
        )}
        style={{
          x: isTop ? x : 0,
          y: isTop ? y : peekY,
          rotate: isTop ? rotate : 0,
          opacity: isTop ? cardOpacity : peekOpacity,
          scale: isTop ? 1 : peekScale,
          zIndex: 10 - stackIndex,
          willChange: 'transform, opacity',
        }}
        animate={controls}
        drag={isTop ? true : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.9}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(_, info) => { setIsDragging(false); handleDragEnd(_, info); }}
        onPointerDown={isTop ? handlePointerDown : undefined}
        onPointerUp={isTop ? handlePointerUp : undefined}
        onPointerCancel={handlePointerUp}
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: isTop ? 1 : peekScale, opacity: isTop ? 1 : peekOpacity }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        aria-label={`Profile of ${profile.name}, ${profile.age}${profile.city ? `, ${profile.city}` : ''}. Double tap for details.`}
        aria-roledescription="swipeable profile card"
        tabIndex={isTop ? 0 : -1}
        onKeyDown={isTop ? (e) => {
          if (e.key === 'ArrowRight') triggerSwipe('right');
          if (e.key === 'ArrowLeft')  triggerSwipe('left');
          if (e.key === 'ArrowUp')    triggerSwipe('up');
          if (e.key === 'Enter')      setExpanded(e => !e);
        } : undefined}
      >
        {/* Photo carousel */}
        <PhotoCarousel
          photos={profile.photos.length > 0 ? profile.photos : ['']}
          name={profile.name}
          onOpenGallery={openGallery}
          onTap={isTop ? handleTap : () => {}}
          dragging={isDragging}
        />

        {/* LIKE badge */}
        {isTop && (
          <SwipeBadge
            opacity={likeOpacity}
            label="Like"
            color="text-emerald-400 border-emerald-400"
            rotate="-18deg"
            position="left"
          />
        )}

        {/* NOPE badge */}
        {isTop && (
          <SwipeBadge
            opacity={nopeOpacity}
            label="Nope"
            color="text-rose-400 border-rose-400"
            rotate="18deg"
            position="right"
          />
        )}

        {/* SUPER badge */}
        {isTop && (
          <SwipeBadge
            opacity={superOpacity}
            label="⭐ Super"
            color="text-sky-400 border-sky-400"
            rotate="0deg"
            position="top"
          />
        )}

        {/* Profile info overlay */}
        <ProfileOverlay
          profile={profile}
          expanded={expanded}
          onToggleExpand={() => setExpanded(e => !e)}
        />
      </motion.article>

      {/* Action buttons (outside the card — not affected by card transform) */}
      {isTop && (
        <ActionBar
          profileName={profile.name}
          onPass={() => triggerSwipe('left')}
          onLike={() => triggerSwipe('right')}
          onSuperLike={() => triggerSwipe('super')}
        />
      )}

      {/* Full-screen photo gallery */}
      <AnimatePresence>
        {galleryOpen && (
          <Gallery
            photos={profile.photos}
            name={profile.name}
            startIndex={galleryStart}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Long-press quick actions */}
      <QuickActions
        open={quickActionsOpen}
        profileName={profile.name}
        onClose={() => setQuickActionsOpen(false)}
        onReport={() => console.info(`Report: ${profile.id}`)}
        onHide={() => { setQuickActionsOpen(false); triggerSwipe('left'); }}
        onBlock={() => { setQuickActionsOpen(false); triggerSwipe('left'); }}
      />
    </>
  );
}
