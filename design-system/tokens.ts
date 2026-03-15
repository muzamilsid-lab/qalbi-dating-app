// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens — single source of truth for all visual decisions.
// Tailwind classes reference these via CSS variables (see globals.css).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary:   { DEFAULT: 'var(--color-primary)',   foreground: 'var(--color-primary-fg)' },
  secondary: { DEFAULT: 'var(--color-secondary)', foreground: 'var(--color-secondary-fg)' },
  accent:    { DEFAULT: 'var(--color-accent)',     foreground: 'var(--color-accent-fg)' },

  // Semantic
  success:   { DEFAULT: 'var(--color-success)',   foreground: 'var(--color-success-fg)' },
  warning:   { DEFAULT: 'var(--color-warning)',   foreground: 'var(--color-warning-fg)' },
  danger:    { DEFAULT: 'var(--color-danger)',    foreground: 'var(--color-danger-fg)' },
  info:      { DEFAULT: 'var(--color-info)',      foreground: 'var(--color-info-fg)' },

  // Surface
  background: 'var(--color-background)',
  surface:    'var(--color-surface)',
  surfaceAlt: 'var(--color-surface-alt)',
  overlay:    'var(--color-overlay)',
  border:     'var(--color-border)',

  // Text
  text: {
    primary:   'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted:     'var(--color-text-muted)',
    inverse:   'var(--color-text-inverse)',
  },

  // Dating-specific palette (raw values for gradients etc.)
  rose:   { 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  pink:   { 400: '#f472b6', 500: '#ec4899', 600: '#db2777' },
  violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
  amber:  { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
} as const;

// ─── Raw CSS variable maps (written to :root / .dark by globals.css) ─────────

export const cssVariables = {
  light: {
    '--color-primary':       '#f43f5e',
    '--color-primary-fg':    '#ffffff',
    '--color-secondary':     '#ec4899',
    '--color-secondary-fg':  '#ffffff',
    '--color-accent':        '#8b5cf6',
    '--color-accent-fg':     '#ffffff',

    '--color-success':       '#22c55e',
    '--color-success-fg':    '#ffffff',
    '--color-warning':       '#f59e0b',
    '--color-warning-fg':    '#000000',
    '--color-danger':        '#ef4444',
    '--color-danger-fg':     '#ffffff',
    '--color-info':          '#3b82f6',
    '--color-info-fg':       '#ffffff',

    '--color-background':    '#fdf2f4',
    '--color-surface':       '#ffffff',
    '--color-surface-alt':   '#fef2f4',
    '--color-overlay':       'rgba(0,0,0,0.4)',
    '--color-border':        '#fecdd3',

    '--color-text-primary':  '#0f0a0b',
    '--color-text-secondary':'#4b1c26',
    '--color-text-muted':    '#9f6672',
    '--color-text-inverse':  '#ffffff',

    '--shadow-sm':  '0 1px 3px rgba(244,63,94,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    '--shadow-md':  '0 4px 16px rgba(244,63,94,0.12), 0 2px 4px rgba(0,0,0,0.06)',
    '--shadow-lg':  '0 8px 32px rgba(244,63,94,0.16), 0 4px 8px rgba(0,0,0,0.08)',
    '--shadow-xl':  '0 20px 48px rgba(244,63,94,0.2), 0 8px 16px rgba(0,0,0,0.1)',
    '--shadow-glow':'0 0 24px rgba(244,63,94,0.35)',
  },
  dark: {
    '--color-primary':       '#fb7185',
    '--color-primary-fg':    '#1a0408',
    '--color-secondary':     '#f472b6',
    '--color-secondary-fg':  '#1a0408',
    '--color-accent':        '#a78bfa',
    '--color-accent-fg':     '#1a0408',

    '--color-success':       '#4ade80',
    '--color-success-fg':    '#052e16',
    '--color-warning':       '#fbbf24',
    '--color-warning-fg':    '#1c0f02',
    '--color-danger':        '#f87171',
    '--color-danger-fg':     '#1c0202',
    '--color-info':          '#60a5fa',
    '--color-info-fg':       '#0c1b38',

    '--color-background':    '#0d0508',
    '--color-surface':       '#1a0c0f',
    '--color-surface-alt':   '#22111a',
    '--color-overlay':       'rgba(0,0,0,0.65)',
    '--color-border':        '#3d1521',

    '--color-text-primary':  '#fdf2f4',
    '--color-text-secondary':'#fecdd3',
    '--color-text-muted':    '#9f6672',
    '--color-text-inverse':  '#0f0a0b',

    '--shadow-sm':  '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    '--shadow-md':  '0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(251,113,133,0.08)',
    '--shadow-lg':  '0 8px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(251,113,133,0.12)',
    '--shadow-xl':  '0 20px 48px rgba(0,0,0,0.6), 0 8px 16px rgba(251,113,133,0.15)',
    '--shadow-glow':'0 0 24px rgba(251,113,133,0.3)',
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  // Mobile-first fluid type scale
  fontFamily: {
    sans:   ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    display:['Playfair Display', 'Georgia', 'serif'],  // headings
    mono:   ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
  fontSize: {
    '2xs': ['0.625rem',  { lineHeight: '0.875rem', letterSpacing: '0.02em' }],  // 10px
    xs:    ['0.75rem',   { lineHeight: '1rem',     letterSpacing: '0.01em' }],  // 12px
    sm:    ['0.875rem',  { lineHeight: '1.25rem',  letterSpacing: '0em'   }],  // 14px
    base:  ['1rem',      { lineHeight: '1.5rem',   letterSpacing: '-0.01em'}], // 16px
    lg:    ['1.125rem',  { lineHeight: '1.75rem',  letterSpacing: '-0.01em'}], // 18px
    xl:    ['1.25rem',   { lineHeight: '1.75rem',  letterSpacing: '-0.02em'}], // 20px
    '2xl': ['1.5rem',    { lineHeight: '2rem',     letterSpacing: '-0.02em'}], // 24px
    '3xl': ['1.875rem',  { lineHeight: '2.25rem',  letterSpacing: '-0.03em'}], // 30px
    '4xl': ['2.25rem',   { lineHeight: '2.5rem',   letterSpacing: '-0.03em'}], // 36px
    '5xl': ['3rem',      { lineHeight: '1',        letterSpacing: '-0.04em'}], // 48px
    '6xl': ['3.75rem',   { lineHeight: '1',        letterSpacing: '-0.04em'}], // 60px
  },
  fontWeight: {
    light:    '300',
    normal:   '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    extrabold:'800',
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

// 4px base unit — all spacing is a multiple of 4
export const spacing = {
  px:   '1px',
  0:    '0px',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  9:    '36px',
  10:   '40px',
  11:   '44px',
  12:   '48px',
  14:   '56px',
  16:   '64px',
  20:   '80px',
  24:   '96px',
  28:   '112px',
  32:   '128px',
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

// Modern, soft radius scale
export const borderRadius = {
  none:    '0px',
  xs:      '4px',
  sm:      '8px',
  DEFAULT: '12px',   // default interactive elements
  md:      '12px',
  lg:      '16px',   // cards
  xl:      '20px',
  '2xl':   '24px',   // modals, sheets
  '3xl':   '32px',
  full:    '9999px', // pills, badges, avatars
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const boxShadow = {
  sm:      'var(--shadow-sm)',
  DEFAULT: 'var(--shadow-md)',
  md:      'var(--shadow-md)',
  lg:      'var(--shadow-lg)',
  xl:      'var(--shadow-xl)',
  glow:    'var(--shadow-glow)',
  none:    '0 0 #0000',
  // Inset for pressed states
  inner:   'inset 0 2px 4px rgba(0,0,0,0.08)',
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    instant: 100,
    fast:    200,
    normal:  300,
    slow:    400,
    slower:  600,
    slowest: 800,
  },
  easing: {
    linear:      [0, 0, 1, 1],
    ease:        [0.25, 0.1, 0.25, 1],
    easeIn:      [0.4, 0, 1, 1],
    easeOut:     [0, 0, 0.2, 1],
    easeInOut:   [0.4, 0, 0.2, 1],
    spring:      { type: 'spring', stiffness: 500, damping: 30 } as const,
    springBouncy:{ type: 'spring', stiffness: 600, damping: 20 } as const,
    springGentle:{ type: 'spring', stiffness: 300, damping: 35 } as const,
    swipe:       [0.19, 1, 0.22, 1],  // custom cubic for card swipes
  },
} as const;

// ─── Breakpoints (mobile-first) ───────────────────────────────────────────────

export const screens = {
  xs:  '375px',
  sm:  '640px',
  md:  '768px',
  lg:  '1024px',
  xl:  '1280px',
  '2xl':'1536px',
} as const;

// ─── Z-index scale ────────────────────────────────────────────────────────────

export const zIndex = {
  behind:  -1,
  base:     0,
  raised:   10,
  overlay:  20,
  dropdown: 30,
  sticky:   40,
  fixed:    50,
  modal:    60,
  toast:    70,
  tooltip:  80,
} as const;

// ─── Glassmorphism presets ────────────────────────────────────────────────────

export const glass = {
  light: {
    background:   'rgba(255, 255, 255, 0.72)',
    backdropBlur: 'blur(16px)',
    border:       '1px solid rgba(255, 255, 255, 0.5)',
    shadow:       '0 8px 32px rgba(244,63,94,0.12)',
  },
  dark: {
    background:   'rgba(26, 12, 15, 0.72)',
    backdropBlur: 'blur(16px)',
    border:       '1px solid rgba(61, 21, 33, 0.6)',
    shadow:       '0 8px 32px rgba(0,0,0,0.4)',
  },
  muted: {
    background:   'rgba(255, 255, 255, 0.45)',
    backdropBlur: 'blur(8px)',
    border:       '1px solid rgba(255, 255, 255, 0.3)',
    shadow:       '0 4px 16px rgba(0,0,0,0.08)',
  },
} as const;

// ─── Gradient presets ─────────────────────────────────────────────────────────

export const gradients = {
  primary:   'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
  warm:      'linear-gradient(135deg, #fb7185 0%, #f472b6 50%, #c084fc 100%)',
  sunset:    'linear-gradient(135deg, #f97316 0%, #f43f5e 50%, #8b5cf6 100%)',
  card:      'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)',
  surface:   'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
  match:     'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)',
} as const;
