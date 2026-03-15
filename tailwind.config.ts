import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? any : T[K] };
import { colors, typography, spacing, borderRadius, boxShadow, screens } from './design-system/tokens';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './design-system/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens,
    extend: {
      colors,
      fontFamily:   typography.fontFamily as Mutable<typeof typography.fontFamily>,
      fontSize:     typography.fontSize   as Mutable<typeof typography.fontSize>,
      fontWeight:   typography.fontWeight as Mutable<typeof typography.fontWeight>,
      spacing:      spacing               as Mutable<typeof spacing>,
      borderRadius: borderRadius          as Mutable<typeof borderRadius>,
      boxShadow:    boxShadow             as Mutable<typeof boxShadow>,
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
        'gradient-warm':    'linear-gradient(135deg, #fb7185 0%, #f472b6 50%, #c084fc 100%)',
        'gradient-sunset':  'linear-gradient(135deg, #f97316 0%, #f43f5e 50%, #8b5cf6 100%)',
        'gradient-card':    'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)',
        'shimmer':          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.19, 1, 0.22, 1)',
        swipe:  'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      keyframes: {
        'heart-beat': {
          '0%, 100%': { transform: 'scale(1)' },
          '25%':      { transform: 'scale(1.35)' },
          '45%':      { transform: 'scale(1.1)' },
          '65%':      { transform: 'scale(1.25)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.88)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'swipe-left': {
          to: { transform: 'translateX(-200%) rotate(-25deg)', opacity: '0' },
        },
        'swipe-right': {
          to: { transform: 'translateX(200%) rotate(25deg)', opacity: '0' },
        },
      },
      animation: {
        'heart-beat':  'heart-beat 0.6s ease-in-out',
        shimmer:       'shimmer 1.5s linear infinite',
        'slide-up':    'slide-up 300ms cubic-bezier(0,0,0.2,1)',
        'fade-in':     'fade-in 200ms ease-out',
        'scale-in':    'scale-in 200ms cubic-bezier(0.19,1,0.22,1)',
        'swipe-left':  'swipe-left 400ms cubic-bezier(0.19,1,0.22,1) forwards',
        'swipe-right': 'swipe-right 400ms cubic-bezier(0.19,1,0.22,1) forwards',
        'pulse-slow':  'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
