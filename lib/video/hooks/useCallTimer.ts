'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_DURATION_MINUTES, EXTENSION_MINUTES, MAX_EXTENSIONS, WARNING_SECONDS } from '../types';

interface UseCallTimerOptions {
  startedAt:      Date | null;
  extensionCount: number;
  onWarning:      () => void;
  onTimeUp:       () => void;
}

interface TimerState {
  elapsed:     number;   // seconds since call started
  remaining:   number;   // seconds until hard limit
  totalLimit:  number;   // current limit in seconds
  isWarning:   boolean;  // show warning banner
  canExtend:   boolean;
  formatted:   { elapsed: string; remaining: string };
}

export function useCallTimer({
  startedAt,
  extensionCount,
  onWarning,
  onTimeUp,
}: UseCallTimerOptions) {
  const totalLimit    = (BASE_DURATION_MINUTES + extensionCount * EXTENSION_MINUTES) * 60;
  const warningFired  = useRef(false);
  const timeUpFired   = useRef(false);
  const rafRef        = useRef<number>(0);

  const [state, setState] = useState<TimerState>({
    elapsed:    0,
    remaining:  totalLimit,
    totalLimit,
    isWarning:  false,
    canExtend:  extensionCount < MAX_EXTENSIONS,
    formatted:  { elapsed: '0:00', remaining: formatSeconds(totalLimit) },
  });

  const tick = useCallback(() => {
    if (!startedAt) return;
    const elapsed   = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const remaining = Math.max(0, totalLimit - elapsed);
    const isWarning = remaining <= WARNING_SECONDS && remaining > 0;

    if (isWarning && !warningFired.current) {
      warningFired.current = true;
      onWarning();
    }

    if (remaining === 0 && !timeUpFired.current) {
      timeUpFired.current = true;
      onTimeUp();
    }

    setState({
      elapsed,
      remaining,
      totalLimit,
      isWarning,
      canExtend: extensionCount < MAX_EXTENSIONS,
      formatted: {
        elapsed:   formatSeconds(elapsed),
        remaining: formatSeconds(remaining),
      },
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [startedAt, totalLimit, extensionCount, onWarning, onTimeUp]);

  useEffect(() => {
    // Reset fired flags when extension count changes
    warningFired.current = false;
    if (startedAt) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [startedAt, extensionCount, tick]);

  return state;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
