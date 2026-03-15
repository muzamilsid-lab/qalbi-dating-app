'use client';

import { LocationPayload } from '../types';

interface Props {
  payload: LocationPayload;
  isMine: boolean;
}

export function LocationMessage({ payload, isMine }: Props) {
  const mapsUrl = `https://www.google.com/maps?q=${payload.lat},${payload.lng}`;

  const staticMap = payload.staticMapUrl
    ?? `https://static-maps.yandex.ru/1.x/?ll=${payload.lng},${payload.lat}&z=14&l=map&size=260,130&pt=${payload.lng},${payload.lat},pm2rdl`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl overflow-hidden w-[240px] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      aria-label={`Open location${payload.label ? `: ${payload.label}` : ''} in Maps`}
      onClick={e => e.stopPropagation()}
    >
      {/* Map preview */}
      <div className="relative h-[120px] bg-slate-200 dark:bg-slate-700">
        <img
          src={staticMap}
          alt={`Map of ${payload.label ?? 'location'}`}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Pin overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-white" aria-hidden>
              <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 8 4.25a1.75 1.75 0 0 1 0 3.5z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Address row */}
      <div className={`px-3 py-2.5 ${isMine ? 'bg-white/15' : 'bg-[var(--color-surface-alt)]'}`}>
        {payload.label && (
          <p className={`text-sm font-semibold truncate ${isMine ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
            {payload.label}
          </p>
        )}
        {payload.address && (
          <p className={`text-xs truncate mt-0.5 ${isMine ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
            {payload.address}
          </p>
        )}
        <p className={`text-xs mt-1 font-medium ${isMine ? 'text-white/60' : 'text-[var(--color-primary)]'}`}>
          Open in Maps ↗
        </p>
      </div>
    </a>
  );
}
