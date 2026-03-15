'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface Props {
  photos: string[];
  name: string;
  /** Fires when the user wants to open the full-screen gallery */
  onOpenGallery: (index: number) => void;
  /** Fired on every tap that isn't a navigation tap (passed up for double-tap) */
  onTap: () => void;
  /** Pauses interaction during card drag */
  dragging: boolean;
}

const BLUR_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmViM2MzIi8+PC9zdmc+';

export function PhotoCarousel({ photos, name, onOpenGallery, onTap, dragging }: Props) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(() => photos.map(() => false));
  const tapStartX = useRef<number | null>(null);
  const tapStartTime = useRef(0);

  // Reset when profile changes
  useEffect(() => {
    setCurrent(0);
    setLoaded(photos.map(() => false));
  }, [photos]);

  const markLoaded = useCallback((i: number) => {
    setLoaded(prev => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  }, []);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(photos.length - 1, c + 1)), [photos.length]);

  // ── Tap zone handler ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tapStartX.current = e.clientX;
    tapStartTime.current = Date.now();
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging) return;
      if (tapStartX.current === null) return;
      const dx = Math.abs(e.clientX - tapStartX.current);
      const dt = Date.now() - tapStartTime.current;
      tapStartX.current = null;

      // Ignore if the pointer moved (it's a drag, not a tap)
      if (dx > 10 || dt > 400) return;

      const { left, width } = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = (e.clientX - left) / width;

      if (relX < 0.3 && current > 0) {
        prev();
      } else if (relX > 0.7 && current < photos.length - 1) {
        next();
      } else {
        // Middle zone — propagate to double-tap detector
        onTap();
      }
    },
    [dragging, current, prev, next, onTap, photos.length]
  );

  return (
    <div
      className="absolute inset-0 select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Photos — only adjacent photos rendered for memory efficiency */}
      {photos.map((src, i) => {
        const isActive = i === current;
        const isAdjacent = Math.abs(i - current) === 1;
        if (!isActive && !isAdjacent) return null;

        return (
          <AnimatePresence key={src} initial={false}>
            {isActive && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Blur placeholder shown until image loads */}
                {!loaded[i] && (
                  <img
                    src={BLUR_PLACEHOLDER}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl"
                  />
                )}
                <img
                  src={src}
                  alt={`Photo ${i + 1} of ${name}`}
                  className={clsx(
                    'absolute inset-0 w-full h-full object-cover',
                    'transition-opacity duration-300',
                    loaded[i] ? 'opacity-100' : 'opacity-0'
                  )}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                  onLoad={() => markLoaded(i)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        );
      })}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div
          className="absolute top-3 inset-x-2 flex gap-1 z-10 pointer-events-none"
          role="tablist"
          aria-label="Profile photos"
        >
          {photos.map((_, i) => (
            <div
              key={i}
              role="tab"
              aria-selected={i === current}
              className={clsx(
                'flex-1 h-[3px] rounded-full transition-all duration-200',
                i === current
                  ? 'bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]'
                  : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}

      {/* Expand gallery button — accessible alternative */}
      <button
        className={clsx(
          'absolute top-3 right-3 z-20',
          'w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm',
          'flex items-center justify-center',
          'text-white text-xs opacity-0 group-hover:opacity-100',
          'transition-opacity duration-200',
          'focus-visible:opacity-100'
        )}
        aria-label={`View all ${photos.length} photos of ${name}`}
        onClick={(e) => { e.stopPropagation(); onOpenGallery(current); }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M2 2h4v1.5H3.5v2.5H2V2zm8 0h4v4h-1.5V3.5H10V2zM2 10h1.5v2.5H6V14H2v-4zm10 2.5V10h1.5v4H10v-1.5h2z"/>
        </svg>
      </button>

      {/* Tap zone hints (invisible, for screen readers) */}
      {current > 0 && (
        <button
          className="sr-only"
          onClick={prev}
          aria-label="Previous photo"
        />
      )}
      {current < photos.length - 1 && (
        <button
          className="sr-only"
          onClick={next}
          aria-label="Next photo"
        />
      )}
    </div>
  );
}

// ─── Full-screen gallery overlay ──────────────────────────────────────────────

interface GalleryProps {
  photos: string[];
  name: string;
  startIndex: number;
  onClose: () => void;
}

export function Gallery({ photos, name, startIndex, onClose }: GalleryProps) {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setCurrent(c => Math.max(0, c - 1));
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(photos.length - 1, c + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s photos`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-2 z-10">
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-2 -ml-2"
          aria-label="Close gallery"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none" strokeWidth={2}>
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-white/70 text-sm">
          {current + 1} / {photos.length}
        </span>
        <div className="w-10" aria-hidden />
      </div>

      {/* Image */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={current}
            src={photos[current]}
            alt={`${name} photo ${current + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            draggable={false}
          />
        </AnimatePresence>

        {/* Nav zones */}
        {current > 0 && (
          <button
            className="absolute left-0 inset-y-0 w-1/4"
            onClick={() => setCurrent(c => c - 1)}
            aria-label="Previous photo"
          />
        )}
        {current < photos.length - 1 && (
          <button
            className="absolute right-0 inset-y-0 w-1/4"
            onClick={() => setCurrent(c => c + 1)}
            aria-label="Next photo"
          />
        )}
      </div>

      {/* Dot strip */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 py-4">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={clsx(
                'w-1.5 h-1.5 rounded-full transition-all duration-200',
                i === current ? 'bg-white scale-125' : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
