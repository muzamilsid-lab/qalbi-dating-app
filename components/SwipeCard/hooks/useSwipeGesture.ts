import {
  useMotionValue,
  useTransform,
  useAnimation,
  PanInfo,
} from 'framer-motion';
import { useCallback, useRef } from 'react';
import { SwipeDirection } from '../types';

const SWIPE_THRESHOLD_X  = 100;   // px — horizontal commit threshold
const SWIPE_THRESHOLD_Y  = -80;   // px — upward commit threshold (negative = up)
const SWIPE_VELOCITY     = 500;   // px/s — fast flick commits regardless of distance
const FLY_OUT_X          = 600;   // px — final x position when flying out
const FLY_OUT_Y          = -800;  // px — final y position when swiping up
const MAX_ROTATION       = 15;    // degrees at ±300px offset
const LIKE_OPACITY_X     = 80;    // px offset where Like becomes fully visible
const SUPER_TAP_DELAY    = 300;   // ms — max gap for double-tap detection

export function useSwipeGesture(onSwipe: (dir: SwipeDirection) => void) {
  const x        = useMotionValue(0);
  const y        = useMotionValue(0);
  const controls = useAnimation();

  // ── Derived values (GPU-only: transform + opacity) ────────────────────────
  const rotate      = useTransform(x, [-300, 0, 300], [-MAX_ROTATION, 0, MAX_ROTATION]);
  const likeOpacity = useTransform(x, [0, LIKE_OPACITY_X], [0, 1]);
  const nopeOpacity = useTransform(x, [-LIKE_OPACITY_X, 0], [1, 0]);
  const superOpacity= useTransform(y, [SWIPE_THRESHOLD_Y, 0], [1, 0]);
  const cardOpacity = useTransform(
    x,
    [-FLY_OUT_X / 2, -SWIPE_THRESHOLD_X, 0, SWIPE_THRESHOLD_X, FLY_OUT_X / 2],
    [0.6, 0.85, 1, 0.85, 0.6]
  );

  // ── Double-tap detection ──────────────────────────────────────────────────
  const lastTapAt = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapAt.current < SUPER_TAP_DELAY) {
      lastTapAt.current = 0;
      triggerSwipe('super');
    } else {
      lastTapAt.current = now;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Programmatic swipe (keyboard / button fallback) ───────────────────────
  const triggerSwipe = useCallback(
    async (dir: SwipeDirection) => {
      const targetX =
        dir === 'right' ? FLY_OUT_X
        : dir === 'left' ? -FLY_OUT_X
        : 0;
      const targetY   = dir === 'up' || dir === 'super' ? FLY_OUT_Y : 0;
      const targetRot = dir === 'right' ? 30 : dir === 'left' ? -30 : 0;

      await controls.start({
        x:       targetX,
        y:       targetY,
        rotate:  targetRot,
        opacity: 0,
        transition: {
          duration: 0.38,
          ease: [0.19, 1, 0.22, 1],
        },
      });
      onSwipe(dir);
    },
    [controls, onSwipe]
  );

  // ── Snap back ─────────────────────────────────────────────────────────────
  const snapBack = useCallback(async () => {
    await controls.start({
      x: 0, y: 0, rotate: 0, opacity: 1,
      transition: { type: 'spring', stiffness: 500, damping: 30 },
    });
  }, [controls]);

  // ── Drag end handler ──────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      const absVx = Math.abs(velocity.x);
      const absVy = Math.abs(velocity.y);

      // Vertical swipe up — profile detail expand
      if (
        offset.y < SWIPE_THRESHOLD_Y &&
        absVy > absVx                    // dominant axis is vertical
      ) {
        triggerSwipe('up');
        return;
      }

      // Horizontal swipe right
      if (offset.x > SWIPE_THRESHOLD_X || velocity.x > SWIPE_VELOCITY) {
        triggerSwipe('right');
        return;
      }

      // Horizontal swipe left
      if (offset.x < -SWIPE_THRESHOLD_X || velocity.x < -SWIPE_VELOCITY) {
        triggerSwipe('left');
        return;
      }

      snapBack();
    },
    [triggerSwipe, snapBack]
  );

  return {
    x, y, rotate,
    likeOpacity, nopeOpacity, superOpacity, cardOpacity,
    controls,
    handleDragEnd,
    handleTap,
    triggerSwipe,
  };
}
