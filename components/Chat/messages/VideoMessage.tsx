'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { VideoPayload } from '../types';
import { formatDuration } from '../hooks/useRelativeTime';

interface Props { payload: VideoPayload }

export function VideoMessage({ payload }: Props) {
  const [open, setOpen] = useState(false);

  const aspect = payload.height ? payload.width / payload.height : 16 / 9;
  const displayW = Math.min(payload.width || 260, 260);
  const displayH = Math.round(displayW / aspect);

  return (
    <>
      <button
        className="relative block rounded-2xl overflow-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        style={{ width: displayW, height: displayH }}
        onClick={() => setOpen(true)}
        aria-label={`Video, ${formatDuration(payload.durationSeconds)}. Tap to play.`}
      >
        {/* Thumbnail */}
        <img
          src={payload.thumbnailUrl}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-14 h-14 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/40"
            whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.35)' }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 20 20" className="w-6 h-6 fill-white translate-x-0.5" aria-hidden>
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
          </motion.div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/60 rounded px-1.5 py-0.5 text-white text-[10px] font-medium tabular-nums">
          {formatDuration(payload.durationSeconds)}
        </div>
      </button>

      {/* Video lightbox */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Video player"
          >
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
              onClick={() => setOpen(false)}
              aria-label="Close video"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
            <motion.video
              src={payload.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-full rounded-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
