'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, useCallback } from 'react';
import { clsx } from 'clsx';

// ─── Haptic feedback (Web Vibration API — graceful no-op on desktop) ──────────

function haptic(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
const hapticPatterns = {
  tap:     10,
  success: [10, 30, 10],
  error:   [20, 50, 20],
  heavy:   30,
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── CVA variants ─────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base classes applied to all variants
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold tracking-tight select-none',
    'rounded-xl',                              // 12px — default radius
    'border border-transparent',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.97]',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
          'shadow-md shadow-[var(--color-primary)]/25',
          'hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-primary)]/30',
          'active:brightness-95',
        ],
        secondary: [
          'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
          'border-[var(--color-border)]',
          'shadow-sm',
          'hover:bg-[var(--color-surface-alt)] hover:border-[var(--color-primary)]/40',
          'dark:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-alt)]',
        ],
        ghost: [
          'bg-transparent text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-primary)]/8',
          'active:bg-[var(--color-primary)]/14',
        ],
        danger: [
          'bg-[var(--color-danger)] text-[var(--color-danger-fg)]',
          'shadow-md shadow-[var(--color-danger)]/20',
          'hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-danger)]/25',
        ],
        gradient: [
          'text-white border-0',
          'bg-gradient-to-r from-rose-500 to-pink-500',
          'shadow-md shadow-rose-500/25',
          'hover:shadow-lg hover:shadow-rose-500/35 hover:brightness-105',
        ],
        outline: [
          'bg-transparent text-[var(--color-primary)]',
          'border-[var(--color-primary)]',
          'hover:bg-[var(--color-primary)]/8',
        ],
      },
      size: {
        sm:  'h-8  px-3 text-sm   rounded-lg  gap-1.5',
        md:  'h-11 px-5 text-base rounded-xl  gap-2',
        lg:  'h-14 px-7 text-lg   rounded-2xl gap-2.5',
        xl:  'h-16 px-8 text-xl   rounded-2xl gap-3',
        icon:'h-11 w-11 p-0       rounded-xl',
      },
      fullWidth: {
        true: 'w-full',
      },
      pill: {
        true: '!rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'>,
    ButtonVariants {
  children?: React.ReactNode;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hapticFeedback?: keyof typeof hapticPatterns | false;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      pill,
      loading = false,
      leftIcon,
      rightIcon,
      hapticFeedback = 'tap',
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (hapticFeedback) haptic(hapticPatterns[hapticFeedback]);
        onClick?.(e);
      },
      [hapticFeedback, onClick]
    );

    const spinnerSize = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' || size === 'xl' ? 'w-5 h-5' : 'w-4 h-4';

    return (
      <motion.button
        ref={ref}
        className={clsx(buttonVariants({ variant, size, fullWidth, pill }), className)}
        disabled={isDisabled}
        onClick={handleClick}
        whileTap={{ scale: isDisabled ? 1 : 0.97 }}
        transition={{ duration: 0.1 }}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Spinner className={spinnerSize} />
        ) : leftIcon ? (
          <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
        ) : null}

        {children && (
          <span className={clsx(loading && 'opacity-0 absolute')}>{children}</span>
        )}

        {!loading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// ─── Icon button variant ──────────────────────────────────────────────────────

export interface IconButtonProps extends ButtonProps {
  label: string;   // required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, ...props }, ref) => (
    <Button ref={ref} size="icon" aria-label={label} {...props}>
      {children}
    </Button>
  )
);

IconButton.displayName = 'IconButton';
