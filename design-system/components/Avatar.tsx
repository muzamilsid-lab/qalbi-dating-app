'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { forwardRef, useState } from 'react';
import { clsx } from 'clsx';

// ─── Size map ──────────────────────────────────────────────────────────────────

const sizeMap = {
  xs:   { container: 'w-6  h-6',  text: 'text-[10px]', badge: 'w-2    h-2',    ring: 'ring-1', indicator: 'w-2   h-2   -right-0 -bottom-0' },
  sm:   { container: 'w-8  h-8',  text: 'text-xs',     badge: 'w-3    h-3',    ring: 'ring-1', indicator: 'w-2.5 h-2.5 right-0  bottom-0' },
  md:   { container: 'w-12 h-12', text: 'text-sm',     badge: 'w-4    h-4',    ring: 'ring-2', indicator: 'w-3   h-3   right-0  bottom-0' },
  lg:   { container: 'w-16 h-16', text: 'text-lg',     badge: 'w-5    h-5',    ring: 'ring-2', indicator: 'w-3.5 h-3.5 right-0.5 bottom-0.5' },
  xl:   { container: 'w-24 h-24', text: 'text-2xl',    badge: 'w-6    h-6',    ring: 'ring-2', indicator: 'w-4   h-4   right-1  bottom-1' },
  '2xl':{ container: 'w-32 h-32', text: 'text-3xl',    badge: 'w-7    h-7',    ring: 'ring-[3px]', indicator: 'w-5 h-5 right-1.5 bottom-1.5' },
} as const;

type AvatarSize = keyof typeof sizeMap;

// ─── Verification badge ────────────────────────────────────────────────────────

function VerificationBadge({ size }: { size: AvatarSize }) {
  const dim = sizeMap[size].badge;
  return (
    <div
      className={clsx(
        'absolute -bottom-0.5 -right-0.5',
        'flex items-center justify-center',
        'rounded-full bg-sky-500 ring-2 ring-[var(--color-surface)]',
        dim
      )}
      aria-label="Verified"
      title="Verified profile"
    >
      <svg
        viewBox="0 0 10 10"
        className="w-[55%] h-[55%] fill-white"
        aria-hidden="true"
      >
        <path d="M8.5 2.5L4 7.5 1.5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

// ─── Online indicator ─────────────────────────────────────────────────────────

function OnlineIndicator({ size, pulse }: { size: AvatarSize; pulse?: boolean }) {
  const s = sizeMap[size];
  return (
    <div
      className={clsx(
        'absolute rounded-full',
        'bg-emerald-500 ring-2 ring-[var(--color-surface)]',
        s.indicator,
        pulse && 'animate-pulse'
      )}
      aria-label="Online"
      title="Online"
    />
  );
}

// ─── Initials generator ───────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Deterministic hue from name — keeps color consistent across renders
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

// ─── CVA ─────────────────────────────────────────────────────────────────────

const avatarVariants = cva(
  'relative inline-flex shrink-0',
  {
    variants: {
      size: {
        xs:    sizeMap.xs.container,
        sm:    sizeMap.sm.container,
        md:    sizeMap.md.container,
        lg:    sizeMap.lg.container,
        xl:    sizeMap.xl.container,
        '2xl': sizeMap['2xl'].container,
      },
    },
    defaultVariants: { size: 'md' },
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string | null;
  name?: string;
  alt?: string;
  verified?: boolean;
  online?: boolean;
  onlinePulse?: boolean;
  /** Blur image for privacy mode (e.g., before match) */
  blur?: boolean;
  /** Ring border */
  ring?: boolean;
  ringColor?: string;
  className?: string;
  onClick?: () => void;
  pressable?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      name = '',
      alt,
      size = 'md',
      verified = false,
      online = false,
      onlinePulse = false,
      blur = false,
      ring = false,
      ringColor,
      className,
      onClick,
      pressable = false,
    },
    ref
  ) => {
    const [imgError, setImgError] = useState(false);
    const showImage = src && !imgError;
    const initials = getInitials(name);
    const hue = nameToHue(name);
    const s = sizeMap[size as AvatarSize] ?? sizeMap.md;

    const inner = (
      <div
        className={clsx(
          'w-full h-full rounded-full overflow-hidden',
          'flex items-center justify-center',
          ring && [s.ring, 'ring-offset-1 ring-offset-[var(--color-surface)]'],
          ring && (ringColor ?? 'ring-[var(--color-primary)]'),
          onClick && 'cursor-pointer',
          blur && 'blur-md'
        )}
        style={!showImage ? {
          background: `hsl(${hue}, 65%, 62%)`,
        } : undefined}
        onClick={onClick}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <span
            className={clsx('font-bold text-white select-none', s.text)}
            aria-label={name || 'Avatar'}
          >
            {initials || '?'}
          </span>
        )}
      </div>
    );

    return (
      <motion.div
        ref={ref}
        className={clsx(avatarVariants({ size }), className)}
        whileTap={pressable ? { scale: 0.93 } : undefined}
        transition={{ duration: 0.1 }}
      >
        {inner}

        {/* Overlays */}
        {verified && <VerificationBadge size={size as AvatarSize} />}
        {online && <OnlineIndicator size={size as AvatarSize} pulse={onlinePulse} />}
      </motion.div>
    );
  }
);

Avatar.displayName = 'Avatar';

// ─── Avatar group ─────────────────────────────────────────────────────────────

export interface AvatarGroupProps {
  avatars: Array<Pick<AvatarProps, 'src' | 'name' | 'verified' | 'online'>>;
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
}

export function AvatarGroup({ avatars, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const shown  = avatars.slice(0, max);
  const excess = avatars.length - max;
  const s = sizeMap[size as AvatarSize] ?? sizeMap.sm;

  return (
    <div className={clsx('flex items-center', className)}>
      {shown.map((avatar, i) => (
        <div
          key={i}
          className="relative"
          style={{ marginLeft: i > 0 ? '-0.5rem' : 0, zIndex: shown.length - i }}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            verified={avatar.verified}
            online={avatar.online}
            size={size}
            ring
            ringColor="ring-[var(--color-surface)]"
          />
        </div>
      ))}

      {excess > 0 && (
        <div
          className={clsx(
            'relative flex items-center justify-center rounded-full',
            'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]',
            'ring-2 ring-[var(--color-surface)]',
            s.container,
            s.text,
            'font-semibold -ml-2'
          )}
          style={{ zIndex: 0 }}
        >
          +{excess}
        </div>
      )}
    </div>
  );
}
