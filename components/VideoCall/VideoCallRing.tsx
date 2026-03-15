'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef }       from 'react';
import { clsx }                    from 'clsx';
import { RingPayload }             from '@/lib/video/types';

interface Props {
  ring:      RingPayload;
  onAccept:  () => void;
  onDecline: () => void;
}

export function VideoCallRing({ ring, onAccept, onDecline }: Props) {
  const autoDeclineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-decline after 30s (missed call)
  useEffect(() => {
    autoDeclineRef.current = setTimeout(onDecline, 30_000);
    return () => { if (autoDeclineRef.current) clearTimeout(autoDeclineRef.current); };
  }, [onDecline]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center mb-8">
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-violet-400/30"
            animate={{ scale: [1, 1 + i * 0.4], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
            style={{ width: 80, height: 80 }}
          />
        ))}

        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-violet-500 shadow-2xl shadow-violet-500/40">
          {ring.initiatorPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ring.initiatorPhoto} alt={ring.initiatorName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white text-3xl font-bold">
              {ring.initiatorName[0]}
            </div>
          )}
        </div>
      </div>

      {/* Name + label */}
      <motion.div
        className="text-center mb-12"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-1">
          Incoming Video Date
        </p>
        <p className="text-white text-3xl font-bold">{ring.initiatorName}</p>
      </motion.div>

      {/* Accept / Decline */}
      <div className="flex items-center gap-16">
        {/* Decline */}
        <motion.div className="flex flex-col items-center gap-2"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
          <motion.button
            onClick={onDecline}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30"
            whileTap={{ scale: 0.9 }}
            aria-label="Decline call"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white rotate-[135deg]" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </motion.button>
          <span className="text-white/60 text-sm">Decline</span>
        </motion.div>

        {/* Accept */}
        <motion.div className="flex flex-col items-center gap-2"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35, type: 'spring' }}>
          <motion.button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
            whileTap={{ scale: 0.9 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            aria-label="Accept call"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
              <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
            </svg>
          </motion.button>
          <span className="text-white/60 text-sm">Accept</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
