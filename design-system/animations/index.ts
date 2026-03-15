import { Variants, Transition } from 'framer-motion';
import { animation } from '../tokens';

const { duration, easing } = animation;

// ─── Reusable transitions ─────────────────────────────────────────────────────

export const transitions = {
  fast: {
    duration: duration.fast / 1000,
    ease: easing.easeOut,
  } satisfies Transition,

  normal: {
    duration: duration.normal / 1000,
    ease: easing.easeOut,
  } satisfies Transition,

  slow: {
    duration: duration.slow / 1000,
    ease: easing.easeInOut,
  } satisfies Transition,

  spring: easing.spring satisfies Transition,
  springBouncy: easing.springBouncy satisfies Transition,
  springGentle: easing.springGentle satisfies Transition,

  swipe: {
    duration: duration.slow / 1000,
    ease: easing.swipe,
  } satisfies Transition,
};

// ─── Fade ─────────────────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fast },
  exit:    { opacity: 0, transition: transitions.fast },
};

export const fadeOut: Variants = {
  hidden:  { opacity: 1 },
  visible: { opacity: 0, transition: transitions.fast },
};

// ─── Slide ────────────────────────────────────────────────────────────────────

export const slideUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: transitions.normal },
  exit:    { opacity: 0, y: 16, transition: transitions.fast },
};

export const slideDown: Variants = {
  hidden:  { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0,  transition: transitions.normal },
  exit:    { opacity: 0, y: -16, transition: transitions.fast },
};

export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: transitions.normal },
  exit:    { opacity: 0, x: 32, transition: transitions.fast },
};

export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0,  transition: transitions.normal },
  exit:    { opacity: 0, x: -32, transition: transitions.fast },
};

// ─── Scale ────────────────────────────────────────────────────────────────────

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1,    transition: easing.springBouncy },
  exit:    { opacity: 0, scale: 0.92, transition: transitions.fast },
};

export const scaleInCenter: Variants = {
  hidden:  { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: easing.springBouncy },
  exit:    { opacity: 0, scale: 0, transition: transitions.fast },
};

// ─── Card swipe ───────────────────────────────────────────────────────────────

const SWIPE_X = 160;
const SWIPE_ROTATE = 25;

export const cardSwipeLeft: Variants = {
  initial: { x: 0,       rotate: 0,              opacity: 1 },
  swipe:   { x: -SWIPE_X * 2, rotate: -SWIPE_ROTATE, opacity: 0,
    transition: transitions.swipe },
};

export const cardSwipeRight: Variants = {
  initial: { x: 0,      rotate: 0,             opacity: 1 },
  swipe:   { x: SWIPE_X * 2, rotate: SWIPE_ROTATE, opacity: 0,
    transition: transitions.swipe },
};

/** Live tilt while dragging — returns style object for use with `style` prop */
export function getCardDragStyle(offsetX: number) {
  const rotate = offsetX / 15;              // max ~20° at edge of screen
  const likeOpacity  = Math.max(0, Math.min(1, offsetX / 80));
  const nopeOpacity  = Math.max(0, Math.min(1, -offsetX / 80));
  return { rotate, likeOpacity, nopeOpacity };
}

// ─── Heart beat (match notification) ─────────────────────────────────────────

export const heartBeat: Variants = {
  idle: { scale: 1 },
  beat: {
    scale: [1, 1.35, 1.1, 1.25, 1],
    transition: {
      duration: duration.slower / 1000,
      ease: easing.easeInOut,
      times: [0, 0.25, 0.45, 0.65, 1],
    },
  },
};

// ─── Match celebration ────────────────────────────────────────────────────────

export const matchReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.5, y: 40 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { ...easing.springBouncy, delay: 0.1 },
  },
};

export const matchTextReveal: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { ...transitions.normal, delay: 0.35 } },
};

// ─── Confetti particle (super like) ──────────────────────────────────────────

/** Generate variants for a single confetti particle */
export function confettiParticle(index: number): Variants {
  const angle = (index / 12) * Math.PI * 2;
  const distance = 80 + Math.random() * 60;
  return {
    hidden:  { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 },
    burst: {
      opacity: [1, 1, 0],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      scale: [1, 0.8, 0.3],
      rotate: (Math.random() - 0.5) * 720,
      transition: {
        duration: duration.slowest / 1000,
        ease: easing.easeOut,
        delay: index * 0.02,
      },
    },
  };
}

// ─── Stagger children ─────────────────────────────────────────────────────────

/** Wrap a list with this to stagger children animations */
export const staggerContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.normal },
};

// ─── Page transitions ─────────────────────────────────────────────────────────

export const pageTransition: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0,  transition: transitions.normal },
  exit:    { opacity: 0, x: -20, transition: transitions.fast },
};

// ─── Notification / toast ─────────────────────────────────────────────────────

export const toastSlide: Variants = {
  hidden:  { opacity: 0, y: -64, scale: 0.92 },
  visible: { opacity: 1, y: 0,   scale: 1,    transition: easing.springGentle },
  exit:    { opacity: 0, y: -32, scale: 0.96, transition: transitions.fast },
};

// ─── Shimmer (skeleton loading) ───────────────────────────────────────────────

export const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 1.5,
      ease: 'linear',
      repeat: Infinity,
    },
  },
};
