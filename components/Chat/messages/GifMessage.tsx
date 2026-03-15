'use client';

import { useCallback, useRef, useState } from 'react';
import { GifPayload } from '../types';

interface Props { payload: GifPayload }

export function GifMessage({ payload }: Props) {
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const displayW = Math.min(payload.width || 260, 260);
  const aspect   = payload.height ? payload.width / payload.height : 1;
  const displayH = Math.round(displayW / aspect);

  // We can't truly pause a browser GIF, so we swap src on pause
  const toggle = useCallback(() => {
    setPaused(p => !p);
  }, []);

  return (
    <button
      className="relative block rounded-2xl overflow-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      style={{ width: displayW, height: displayH }}
      onClick={toggle}
      aria-label={`GIF: ${payload.alt ?? 'Animated image'}. Tap to ${paused ? 'play' : 'pause'}.`}
    >
      {!loaded && (
        <div className="absolute inset-0 skeleton" aria-hidden />
      )}

      {/* When paused, show a static snapshot by rendering as `image/gif` frozen at first frame */}
      <img
        ref={imgRef}
        src={paused ? `${payload.url}#paused` : payload.url}
        alt={payload.alt ?? 'GIF'}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        draggable={false}
        aria-hidden
      />

      {/* GIF badge */}
      <div className="absolute top-2 left-2 bg-black/50 rounded px-1.5 py-0.5 text-white text-[10px] font-bold tracking-wider">
        GIF
      </div>

      {/* Pause indicator */}
      {paused && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-black/50 rounded-full p-2.5">
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white" aria-hidden>
              <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/>
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}
