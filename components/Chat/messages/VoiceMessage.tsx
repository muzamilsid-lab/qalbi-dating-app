'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { VoicePayload } from '../types';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { formatDuration } from '../hooks/useRelativeTime';

const BAR_COUNT = 40;

interface Props {
  payload: VoicePayload;
  isMine: boolean;
}

export function VoiceMessage({ payload, isMine }: Props) {
  const { playing, progress, loading, error, toggle, seek, remaining } =
    useVoicePlayer(payload.url, payload.durationSeconds);

  // Downsample or upsample waveform to BAR_COUNT bars
  const bars = resampleWaveform(payload.waveform, BAR_COUNT);

  const trackRef = useRef<HTMLDivElement>(null);

  const handleSeek = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!trackRef.current) return;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - left) / width));
      seek(fraction);
    },
    [seek]
  );

  const activeColor  = isMine ? 'bg-white'          : 'bg-[var(--color-primary)]';
  const inactiveColor= isMine ? 'bg-white/35'        : 'bg-[var(--color-border)]';
  const textColor    = isMine ? 'text-white/80'      : 'text-[var(--color-text-muted)]';
  const iconBg       = isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20';
  const iconColor    = isMine ? 'text-white'         : 'text-[var(--color-primary)]';

  return (
    <div className="flex items-center gap-3 w-full min-w-[200px] max-w-[260px]">
      {/* Play / Pause button */}
      <button
        onClick={toggle}
        disabled={error}
        className={`
          w-10 h-10 rounded-full flex items-center justify-center shrink-0
          transition-colors duration-150 focus-visible:ring-2
          focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1
          ${iconBg} ${iconColor}
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
        aria-label={error ? 'Audio unavailable' : playing ? 'Pause voice message' : 'Play voice message'}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : error ? (
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden>
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-9v4a1 1 0 11-2 0V9a1 1 0 112 0zm0-4a1 1 0 11-2 0 1 1 0 012 0z"/>
          </svg>
        ) : playing ? (
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden>
            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current translate-x-px" aria-hidden>
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
          </svg>
        )}
      </button>

      {/* Waveform track */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={trackRef}
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onPointerDown={handleSeek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Voice message progress"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.05));
            if (e.key === 'ArrowLeft')  seek(Math.max(0, progress - 0.05));
          }}
        >
          {bars.map((amplitude, i) => {
            const isPlayed = i / BAR_COUNT < progress;
            const heightPct = Math.max(15, amplitude * 100);
            return (
              <motion.div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-100 ${isPlayed ? activeColor : inactiveColor}`}
                style={{ height: `${heightPct}%` }}
                animate={playing && isPlayed ? { scaleY: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.4, repeat: playing ? Infinity : 0, delay: (i % 5) * 0.08 }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <span className={`text-[10px] font-medium tabular-nums ${textColor}`}>
          {playing
            ? formatDuration(remaining)
            : formatDuration(payload.durationSeconds)
          }
        </span>
      </div>
    </div>
  );
}

function resampleWaveform(waveform: number[], targetLength: number): number[] {
  if (waveform.length === 0) {
    // Fallback: random-looking waveform for missing data
    return Array.from({ length: targetLength }, (_, i) =>
      0.3 + 0.5 * Math.abs(Math.sin(i * 0.8) * Math.cos(i * 0.3))
    );
  }
  if (waveform.length === targetLength) return waveform;
  return Array.from({ length: targetLength }, (_, i) => {
    const src = (i / (targetLength - 1)) * (waveform.length - 1);
    const lo  = Math.floor(src);
    const hi  = Math.min(lo + 1, waveform.length - 1);
    const t   = src - lo;
    return waveform[lo] * (1 - t) + waveform[hi] * t;
  });
}
