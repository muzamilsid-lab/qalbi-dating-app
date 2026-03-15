'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState }                from 'react';
import { clsx }                    from 'clsx';
import { CallEndReason }           from '@/lib/video/types';

interface Props {
  callId:          string;
  duration:        string;  // formatted "5:42"
  partnerName:     string;
  partnerPhoto:    string | null;
  endReason:       CallEndReason | null;
  onRatingSubmit:  (rating: number, unmatch: boolean, note?: string) => void;
  onContinueChat:  () => void;
  onDismiss:       () => void;
}

const STAR_LABELS = ['', 'Uncomfortable', 'Not great', 'It was ok', 'Really good', 'Amazing! ✨'];

export function VideoCallEnded({
  callId, duration, partnerName, partnerPhoto,
  endReason, onRatingSubmit, onContinueChat, onDismiss,
}: Props) {
  const [rating,  setRating]  = useState(0);
  const [hovered, setHovered] = useState(0);
  const [note,    setNote]    = useState('');
  const [unmatch, setUnmatch] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitted(true);
    onRatingSubmit(rating, unmatch, note.trim() || undefined);
    if (unmatch) {
      onDismiss();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {!submitted ? (
        <>
          {/* Avatar + duration */}
          <motion.div
            className="flex flex-col items-center gap-4 mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-700">
                {partnerPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={partnerPhoto} alt={partnerName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white text-2xl font-bold">
                    {partnerName[0]}
                  </div>
                )}
              </div>
              {endReason === 'duration_limit' && (
                <div className="absolute -top-1 -right-1 text-xl">⏰</div>
              )}
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">{partnerName}</p>
              <p className="text-white/40 text-sm mt-1">Video date · {duration}</p>
            </div>
          </motion.div>

          {/* Rating prompt */}
          <motion.div
            className="w-full max-w-xs flex flex-col items-center gap-6"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <p className="text-white/70 text-sm text-center">
              How was your video date?
            </p>

            {/* Stars */}
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(star => (
                <motion.button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="text-4xl"
                  whileTap={{ scale: 1.3 }}
                  aria-label={`Rate ${star} star`}
                >
                  {star <= (hovered || rating) ? '⭐' : '☆'}
                </motion.button>
              ))}
            </div>

            {/* Label */}
            <AnimatePresence mode="wait">
              {(hovered || rating) > 0 && (
                <motion.p
                  key={hovered || rating}
                  className="text-white/60 text-sm h-5"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {STAR_LABELS[hovered || rating]}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Optional note */}
            {rating > 0 && rating <= 3 && (
              <motion.textarea
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 80, opacity: 1 }}
                placeholder="What could be improved? (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={300}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm placeholder:text-white/30 outline-none focus:border-violet-400 resize-none"
              />
            )}

            {/* Unmatch toggle */}
            <button
              onClick={() => setUnmatch(u => !u)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                unmatch
                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                  : 'border-white/10 text-white/40 hover:text-white/60',
              )}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/>
              </svg>
              {unmatch ? 'Unmatch after submit' : 'Unmatch after this date'}
            </button>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full">
              <motion.button
                onClick={handleSubmit}
                disabled={rating === 0}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-base disabled:opacity-40"
                whileTap={{ scale: 0.97 }}
              >
                {unmatch ? 'Submit & Unmatch' : 'Submit Rating'}
              </motion.button>

              <button
                onClick={() => { onRatingSubmit(0, false); onContinueChat(); }}
                className="text-white/40 text-sm text-center py-2 hover:text-white/60 transition-colors"
              >
                Skip · Continue chatting
              </button>
            </div>
          </motion.div>
        </>
      ) : (
        // Post-submission
        <motion.div
          className="flex flex-col items-center gap-4 text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <div className="text-6xl">💜</div>
          <p className="text-white font-bold text-2xl">Rating submitted!</p>
          <p className="text-white/50 text-sm max-w-xs">
            Your feedback helps keep Qalbi a safe and fun space.
          </p>
          <motion.button
            onClick={onContinueChat}
            className="mt-4 px-8 py-3 rounded-2xl bg-white/10 text-white font-semibold"
            whileTap={{ scale: 0.97 }}
          >
            Continue Chatting
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
