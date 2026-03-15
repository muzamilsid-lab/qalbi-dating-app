'use client';

import { motion }     from 'framer-motion';
import { clsx }       from 'clsx';

interface Props {
  partnerName:  string;
  partnerPhoto: string | null;
  onRequest:    () => void;
  disabled?:    boolean;
}

export function VideoCallRequest({ partnerName, partnerPhoto, onRequest, disabled }: Props) {
  return (
    <motion.div
      className="w-[260px] rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    >
      {/* Header gradient */}
      <div className="h-1.5 bg-gradient-to-r from-violet-500 via-rose-500 to-pink-500" />

      <div className="px-4 pt-4 pb-5 flex flex-col items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[var(--color-border)]">
            {partnerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partnerPhoto} alt={partnerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white text-xl font-bold">
                {partnerName[0]}
              </div>
            )}
          </div>
          {/* Video icon badge */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center border-2 border-[var(--color-surface)]">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="currentColor">
              <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">
            Video Date
          </p>
          <p className="text-[var(--color-text-primary)] font-bold text-sm leading-snug">
            Ready for a face-to-face moment?
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            15-minute video date with {partnerName}
          </p>
        </div>

        {/* CTA */}
        <motion.button
          onClick={onRequest}
          disabled={disabled}
          className={clsx(
            'w-full py-2.5 rounded-xl font-bold text-sm text-white',
            'bg-gradient-to-r from-violet-500 to-rose-500',
            'flex items-center justify-center gap-2',
            'disabled:opacity-40',
          )}
          whileTap={{ scale: 0.97 }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
          </svg>
          Start Video Date 💜
        </motion.button>
      </div>
    </motion.div>
  );
}
