import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_DELAY = 500;   // ms
const DOUBLE_TAP_DELAY  = 280;  // ms

interface Options {
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onTap?: () => void;
}

export function useMessageGestures({ onLongPress, onDoubleTap, onTap }: Options) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAt      = useRef(0);
  const moved          = useRef(false);

  const handlePointerDown = useCallback(() => {
    moved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!moved.current) {
        setShowTimestamp(true);
        onLongPress?.();
      }
    }, LONG_PRESS_DELAY);
  }, [onLongPress]);

  const handlePointerMove = useCallback(() => {
    moved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (moved.current) return;

    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_DELAY) {
      lastTapAt.current = 0;
      onDoubleTap?.();
    } else {
      lastTapAt.current = now;
      // Delayed single-tap so double-tap can intercept
      setTimeout(() => {
        if (Date.now() - lastTapAt.current >= DOUBLE_TAP_DELAY) {
          onTap?.();
        }
      }, DOUBLE_TAP_DELAY + 10);
    }
  }, [onDoubleTap, onTap]);

  const handlePointerCancel = useCallback(() => {
    moved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const hideTimestamp = useCallback(() => setShowTimestamp(false), []);

  return {
    showTimestamp,
    hideTimestamp,
    gestureProps: {
      onPointerDown:   handlePointerDown,
      onPointerMove:   handlePointerMove,
      onPointerUp:     handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
