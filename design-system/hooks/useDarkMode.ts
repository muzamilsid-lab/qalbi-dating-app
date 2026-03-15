'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'qalbi-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-theme', resolved);
  // Also update <meta name="theme-color"> for mobile browser chrome
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0d0508' : '#f43f5e');
  }
}

export function useDarkMode() {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Initialise from localStorage on mount (runs only client-side)
  useEffect(() => {
    const stored = getStoredTheme();
    const resolved = stored === 'system' ? getSystemTheme() : stored;
    setThemeState(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Listen for OS-level preference changes when theme is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const resolved: ResolvedTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (next: Theme) => {
    const resolved: ResolvedTheme = next === 'system' ? getSystemTheme() : next;
    setThemeState(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return { theme, resolvedTheme, setTheme, toggle, isDark: resolvedTheme === 'dark' };
}

/**
 * Inline script to inject before page paint — prevents flash of wrong theme.
 * Add as <script dangerouslySetInnerHTML={{ __html: darkModeScript }} /> in layout.tsx
 */
export const darkModeScript = `
(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var resolved = stored === 'dark' ? 'dark'
      : stored === 'light' ? 'light'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.setAttribute('data-theme', resolved);
  } catch(e) {}
})();
`;
