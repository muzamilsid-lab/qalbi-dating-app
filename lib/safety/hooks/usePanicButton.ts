'use client';

import { useCallback, useEffect, useRef } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────

const SHAKE_THRESHOLD   = 15;    // m/s² deviation
const SHAKE_TIMEOUT_MS  = 1200;  // window to count shakes
const REQUIRED_SHAKES   = 3;     // shakes needed to trigger

// Disguise URLs — open a convincing decoy page then close the app tab
const DISGUISE_OPTIONS = {
  calculator: 'https://www.google.com/search?q=calculator',
  notes:      'https://keep.google.com',
  weather:    'https://www.google.com/search?q=weather',
} as const;

export type DisguiseTarget = keyof typeof DISGUISE_OPTIONS;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UsePanicButtonOptions {
  enabled?:  boolean;
  disguise?: DisguiseTarget;
  onTrigger?: () => void;   // optional callback before navigation
}

export function usePanicButton({
  enabled  = true,
  disguise = 'calculator',
  onTrigger,
}: UsePanicButtonOptions = {}) {
  const shakeTimestamps = useRef<number[]>([]);

  const trigger = useCallback(() => {
    onTrigger?.();

    // Replace current history entry with disguise URL so back-button goes there
    const disguiseUrl = DISGUISE_OPTIONS[disguise];
    window.location.replace(disguiseUrl);
  }, [disguise, onTrigger]);

  // ── Shake detection via DeviceMotionEvent ───────────────────────────────

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (!('DeviceMotionEvent' in window)) return;

    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = Date.now();

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const { x = 0, y = 0, z = 0 } = acc;
      const now   = Date.now();
      const delta = now - lastTime;

      if (delta > 0) {
        const speed = Math.abs(x! - lastX) + Math.abs(y! - lastY) + Math.abs(z! - lastZ);
        if (speed > SHAKE_THRESHOLD) {
          shakeTimestamps.current.push(now);
          // Prune old shakes outside the window
          shakeTimestamps.current = shakeTimestamps.current.filter(
            t => now - t < SHAKE_TIMEOUT_MS,
          );
          if (shakeTimestamps.current.length >= REQUIRED_SHAKES) {
            shakeTimestamps.current = [];
            trigger();
          }
        }
      }

      lastX = x!; lastY = y!; lastZ = z!;
      lastTime = now;
    };

    // iOS 13+ requires permission
    const requestPermission = async () => {
      const DME = DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DME.requestPermission === 'function') {
        const result = await DME.requestPermission().catch(() => 'denied');
        if (result !== 'granted') return;
      }
      window.addEventListener('devicemotion', handleMotion);
    };

    requestPermission();
    return () => { window.removeEventListener('devicemotion', handleMotion); };
  }, [enabled, trigger]);

  return { trigger };
}

// ─── Android Content Observer shim (React Native / Expo bridge) ───────────────
// When running inside a React Native WebView, the native layer should post
// a message to the webview when a screenshot is detected:
//   window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCREENSHOT' }))
// This hook wires up that listener.

export function useNativeScreenshotBridge(onScreenshot: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data ?? '{}');
        if (msg.type === 'SCREENSHOT') onScreenshot();
      } catch { /* ignore non-JSON messages */ }
    };

    window.addEventListener('message', handler);
    return () => { window.removeEventListener('message', handler); };
  }, [onScreenshot]);
}
