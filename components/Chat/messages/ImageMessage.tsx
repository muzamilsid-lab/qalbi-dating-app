'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { ImagePayload } from '../types';

interface Props {
  payload: ImagePayload;
  isMine: boolean;
}

export function ImageMessage({ payload }: Props) {
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const aspectRatio = payload.height
    ? `${payload.width} / ${payload.height}`
    : '4 / 3';

  // Clamp display size — max 260px wide
  const displayWidth = Math.min(payload.width || 260, 260);
  const displayHeight = payload.height
    ? Math.round((displayWidth / payload.width) * payload.height)
    : undefined;

  const open  = useCallback(() => setLightbox(true),  []);
  const close = useCallback(() => setLightbox(false), []);

  return (
    <>
      <button
        className="block rounded-2xl overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)]"
        style={{ width: displayWidth, height: displayHeight }}
        onClick={open}
        aria-label={`Image: ${payload.alt ?? 'Photo'}. Tap to expand.`}
      >
        {/* Aspect-ratio placeholder */}
        <div
          className="relative bg-[var(--color-surface-alt)] overflow-hidden"
          style={{ aspectRatio, width: '100%' }}
        >
          {/* Blur thumbnail shown while loading */}
          {payload.thumbnailUrl && !loaded && (
            <img
              src={payload.thumbnailUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-md scale-110"
            />
          )}

          {/* Skeleton shimmer */}
          {!loaded && !error && (
            <div className="absolute inset-0 skeleton" aria-hidden />
          )}

          {!error ? (
            <img
              src={payload.url}
              alt={payload.alt ?? 'Photo'}
              className={`
                absolute inset-0 w-full h-full object-cover
                transition-opacity duration-300
                ${loaded ? 'opacity-100' : 'opacity-0'}
              `}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)]">
              <span className="text-2xl" aria-hidden>📷</span>
              <span className="text-xs">Failed to load</span>
            </div>
          )}

          {/* Tap-to-expand hint */}
          {loaded && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-150 flex items-center justify-center">
              <div className="opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-black/40 rounded-full p-2">
                  <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white" aria-hidden>
                    <path d="M3 3h5v2H5v3H3V3zm9 0h5v5h-2V5h-3V3zM3 12h2v3h3v2H3v-5zm12 3h-3v2h5v-5h-2v3z"/>
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label={payload.alt ?? 'Photo'}
          >
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
              onClick={close}
              aria-label="Close photo"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>

            <motion.img
              src={payload.url}
              alt={payload.alt ?? 'Photo'}
              className="max-w-full max-h-full object-contain"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
