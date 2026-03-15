'use client';

import { motion } from 'framer-motion';
import { DateSuggestionPayload } from '../types';

interface Props {
  payload: DateSuggestionPayload;
  isMine: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}

const STATUS_CONFIG = {
  accepted: { label: '✅ Date confirmed!',    bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  declined: { label: '❌ Date declined',      bg: 'bg-red-500/10 border-red-500/30',         text: 'text-red-500' },
  pending:  { label: '',                       bg: '',                                         text: '' },
} as const;

function formatDateSuggestion(date: Date): { day: string; time: string } {
  return {
    day:  date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function DateSuggestionMessage({ payload, isMine, onAccept, onDecline }: Props) {
  const { day, time } = formatDateSuggestion(new Date(payload.suggestedAt));
  const status = STATUS_CONFIG[payload.status];

  return (
    <div
      className={`
        w-[260px] rounded-2xl overflow-hidden border
        ${isMine
          ? 'bg-white/15 border-white/25'
          : 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm'
        }
      `}
    >
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 border-b ${isMine ? 'border-white/15' : 'border-[var(--color-border)]'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl" aria-hidden>📅</span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isMine ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
            Date Suggestion
          </span>
        </div>

        {/* Date + time */}
        <p className={`text-sm font-bold leading-snug ${isMine ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
          {day}
        </p>
        <p className={`text-sm ${isMine ? 'text-white/80' : 'text-[var(--color-text-secondary)]'}`}>
          {time}
        </p>

        {/* Venue */}
        {payload.venueName && (
          <div className="flex items-start gap-1 mt-2">
            <span className="text-sm" aria-hidden>📍</span>
            <div>
              <p className={`text-sm font-medium ${isMine ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
                {payload.venueName}
              </p>
              {payload.venueAddress && (
                <p className={`text-xs ${isMine ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                  {payload.venueAddress}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Note */}
        {payload.note && (
          <p className={`text-xs mt-2 italic ${isMine ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
            "{payload.note}"
          </p>
        )}
      </div>

      {/* Footer — status or action buttons */}
      <div className="px-4 py-3">
        {payload.status === 'pending' && !isMine ? (
          <div className="flex gap-2">
            <motion.button
              onClick={onDecline}
              className="flex-1 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] transition-colors"
              whileTap={{ scale: 0.97 }}
              aria-label="Decline date suggestion"
            >
              Decline
            </motion.button>
            <motion.button
              onClick={onAccept}
              className="flex-1 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm"
              whileTap={{ scale: 0.97 }}
              aria-label="Accept date suggestion"
            >
              Accept 💕
            </motion.button>
          </div>
        ) : payload.status === 'pending' && isMine ? (
          <p className={`text-xs text-center ${isMine ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
            Waiting for response…
          </p>
        ) : (
          <motion.div
            className={`text-center text-sm font-semibold py-1 rounded-xl border ${status.bg} ${status.text}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {status.label}
          </motion.div>
        )}
      </div>
    </div>
  );
}
