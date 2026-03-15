'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { forwardRef, useCallback, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { getCardDragStyle, cardSwipeLeft, cardSwipeRight, transitions } from '../animations';

// ─── Base card ────────────────────────────────────────────────────────────────

const cardVariants = cva(
  [
    'relative overflow-hidden',
    'transition-shadow duration-200',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--color-surface)]',
          'border border-[var(--color-border)]',
          'shadow-md hover:shadow-lg',
          'rounded-2xl',
        ],
        glass: [
          'backdrop-blur-xl',
          'bg-white/70 dark:bg-black/40',
          'border border-white/50 dark:border-white/10',
          'shadow-lg',
          'rounded-2xl',
        ],
        elevated: [
          'bg-[var(--color-surface)]',
          'shadow-xl hover:shadow-[0_24px_64px_rgba(244,63,94,0.18)]',
          'rounded-2xl',
        ],
        flat: [
          'bg-[var(--color-surface-alt)]',
          'rounded-xl',
        ],
      },
      padding: {
        none: '',
        sm:   'p-3',
        md:   'p-4',
        lg:   'p-6',
        xl:   'p-8',
      },
      gradientBorder: {
        true: [
          'before:absolute before:inset-0 before:rounded-[inherit] before:p-px',
          'before:bg-gradient-to-br before:from-rose-500 before:via-pink-500 before:to-violet-500',
          'before:-z-10',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

type CardVariants = VariantProps<typeof cardVariants>;

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart'>,
    CardVariants {
  children?: React.ReactNode;
  pressable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, gradientBorder, pressable = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={clsx(cardVariants({ variant, padding, gradientBorder }), className)}
        whileHover={pressable ? { y: -2, boxShadow: 'var(--shadow-xl)' } : undefined}
        whileTap={pressable ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.15 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// ─── Profile swipe card ───────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80;   // px — how far to drag before triggering swipe
const DECISION_VELOCITY = 400; // px/s — fast flick also triggers

export type SwipeDirection = 'left' | 'right' | 'super';

export interface ProfileCardProps {
  profile: {
    id: string;
    name: string;
    age: number;
    city?: string;
    bio?: string;
    photoUrl?: string;
    verified?: boolean;
    online?: boolean;
    distance?: number;
  };
  onSwipe?: (direction: SwipeDirection) => void;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** Index in stack — higher = back of stack */
  stackIndex?: number;
}

export function ProfileCard({
  profile,
  onSwipe,
  onTap,
  className,
  style,
  stackIndex = 0,
}: ProfileCardProps) {
  const x = useMotionValue(0);
  const [swipeDir, setSwipeDir] = useState<SwipeDirection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Derived transforms from drag offset
  const rotate        = useTransform(x, [-200, 0, 200], [-22, 0, 22]);
  const likeOpacity   = useTransform(x, [0, 60, 120], [0, 0.9, 1]);
  const nopeOpacity   = useTransform(x, [-120, -60, 0], [1, 0.9, 0]);
  const cardScale     = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const cardBrightness= useTransform(x, [-200, 0, 200], [0.85, 1, 0.85]);

  // Stack peek effect
  const peekScale     = 1 - stackIndex * 0.04;
  const peekY         = stackIndex * 12;
  const peekOpacity   = 1 - stackIndex * 0.25;

  const triggerSwipe = useCallback(
    (dir: SwipeDirection) => {
      setSwipeDir(dir);
      onSwipe?.(dir);
    },
    [onSwipe]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      setIsDragging(false);
      const { offset, velocity } = info;
      if (offset.x > SWIPE_THRESHOLD || velocity.x > DECISION_VELOCITY) {
        triggerSwipe('right');
      } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -DECISION_VELOCITY) {
        triggerSwipe('left');
      } else {
        // Snap back
        x.set(0);
      }
    },
    [triggerSwipe, x]
  );

  if (stackIndex > 2) return null; // only render top 3 cards

  const isTop = stackIndex === 0;

  return (
    <AnimatePresence>
      {!swipeDir && (
        <motion.div
          className={clsx(
            'absolute inset-0 cursor-grab active:cursor-grabbing select-none',
            className
          )}
          style={{
            ...style,
            x: isTop ? x : 0,
            rotate: isTop ? rotate : 0,
            scale: isTop ? cardScale : peekScale,
            y: isTop ? 0 : peekY,
            opacity: peekOpacity,
            zIndex: 10 - stackIndex,
            filter: isTop ? `brightness(${cardBrightness})` : undefined,
          }}
          drag={isTop ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.85}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          onTap={() => !isDragging && onTap?.()}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          animate={(
            swipeDir === 'right' ? cardSwipeRight.swipe
            : swipeDir === 'left' ? cardSwipeLeft.swipe
            : { scale: 1 }
          ) as any}
          transition={swipeDir ? transitions.swipe : transitions.spring}
          exit={{ opacity: 0 }}
        >
          {/* Card background */}
          <div className="w-full h-full rounded-3xl overflow-hidden shadow-xl bg-gray-200 dark:bg-gray-800">
            {/* Photo */}
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-rose-200 to-pink-300 dark:from-rose-900 dark:to-pink-900 flex items-center justify-center">
                <span className="text-8xl opacity-30">👤</span>
              </div>
            )}

            {/* Bottom gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

            {/* LIKE badge */}
            {isTop && (
              <motion.div
                className="absolute top-8 left-6 border-4 border-emerald-400 rounded-xl px-4 py-1.5 rotate-[-20deg]"
                style={{ opacity: likeOpacity }}
              >
                <span className="text-emerald-400 font-black text-2xl tracking-widest uppercase">
                  Like
                </span>
              </motion.div>
            )}

            {/* NOPE badge */}
            {isTop && (
              <motion.div
                className="absolute top-8 right-6 border-4 border-rose-400 rounded-xl px-4 py-1.5 rotate-[20deg]"
                style={{ opacity: nopeOpacity }}
              >
                <span className="text-rose-400 font-black text-2xl tracking-widest uppercase">
                  Nope
                </span>
              </motion.div>
            )}

            {/* Profile info */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              {/* Online + distance row */}
              <div className="flex items-center gap-2 mb-1">
                {profile.online && (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                )}
                {profile.distance !== undefined && (
                  <span className="text-white/60 text-xs">
                    {profile.distance < 1 ? 'Nearby' : `${profile.distance} km away`}
                  </span>
                )}
              </div>

              {/* Name + age */}
              <div className="flex items-baseline gap-2">
                <h2 className="text-white font-bold text-2xl leading-tight">
                  {profile.name}
                </h2>
                <span className="text-white/80 text-xl">{profile.age}</span>
                {profile.verified && (
                  <span
                    className="text-sky-400 text-lg"
                    title="Verified"
                    aria-label="Verified profile"
                  >
                    ✓
                  </span>
                )}
              </div>

              {/* City */}
              {profile.city && (
                <p className="text-white/70 text-sm mt-0.5">{profile.city}</p>
              )}

              {/* Bio (truncated) */}
              {profile.bio && (
                <p className="text-white/60 text-sm mt-2 line-clamp-2 leading-snug">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
