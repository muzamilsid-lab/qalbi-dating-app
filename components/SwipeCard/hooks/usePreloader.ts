import { useEffect } from 'react';
import { Profile } from '../types';

const cache = new Set<string>();

function preloadImage(src: string): void {
  if (cache.has(src)) return;
  cache.add(src);
  const img = new window.Image();
  img.src = src;
}

/**
 * Eagerly preloads the first photo of the next N profiles
 * and all photos of the current top card.
 */
export function usePreloader(profiles: Profile[], topIndex: number, ahead = 3) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // All photos of the current top card
    const top = profiles[topIndex];
    if (top) {
      top.photos.forEach(preloadImage);
    }

    // First photo of the next `ahead` cards
    for (let i = topIndex + 1; i <= topIndex + ahead && i < profiles.length; i++) {
      const photo = profiles[i]?.photos[0];
      if (photo) preloadImage(photo);
    }
  }, [profiles, topIndex, ahead]);
}
