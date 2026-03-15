'use client';

import { useCallback, useState }   from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx                        from 'clsx';
import { VISIBILITY_META }         from '@/lib/safety/types';
import type { PhotoVisibility }    from '@/lib/safety/types';

// ─── Inline segmented control ─────────────────────────────────────────────────

interface Props {
  photoId:     string;
  visibility:  PhotoVisibility;
  onChange?:   (visibility: PhotoVisibility) => void;
}

export function PhotoVisibilityToggle({ photoId, visibility, onChange }: Props) {
  const [current, setCurrent] = useState<PhotoVisibility>(visibility);
  const [saving,  setSaving]  = useState(false);

  const update = useCallback(async (next: PhotoVisibility) => {
    if (next === current || saving) return;
    setSaving(true);

    const res = await fetch(`/api/photos/${photoId}/visibility`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ visibility: next }),
    });

    if (res.ok) {
      setCurrent(next);
      onChange?.(next);
    }
    setSaving(false);
  }, [current, saving, photoId, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
        {(Object.keys(VISIBILITY_META) as PhotoVisibility[]).map(v => {
          const meta      = VISIBILITY_META[v];
          const isActive  = current === v;
          return (
            <button
              key={v}
              disabled={saving}
              onClick={() => update(v)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? v === 'private'
                    ? 'bg-red-800 text-white'
                    : v === 'matches'
                      ? 'bg-purple-700 text-white'
                      : 'bg-neutral-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-300',
                saving && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span>{meta.icon}</span>
              <span className="hidden sm:inline">{meta.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-600 text-center">
        {VISIBILITY_META[current].description}
      </p>
    </div>
  );
}

// ─── Reveal button — used on a private photo to reveal to a specific person ──

interface RevealButtonProps {
  photoId:        string;
  revealToUserId: string;
  partnerName:    string;
  alreadyRevealed?: boolean;
}

export function PhotoRevealButton({
  photoId, revealToUserId, partnerName, alreadyRevealed = false,
}: RevealButtonProps) {
  const [revealed, setRevealed] = useState(alreadyRevealed);
  const [loading,  setLoading]  = useState(false);

  const toggle = useCallback(async () => {
    setLoading(true);
    if (revealed) {
      await fetch(`/api/photos/${photoId}/reveal`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ revokeFromUserId: revealToUserId }),
      });
      setRevealed(false);
    } else {
      await fetch(`/api/photos/${photoId}/reveal`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ revealToUserId }),
      });
      setRevealed(true);
    }
    setLoading(false);
  }, [revealed, photoId, revealToUserId]);

  return (
    <button
      disabled={loading}
      onClick={toggle}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
        revealed
          ? 'bg-purple-900/60 text-purple-300 hover:bg-purple-900'
          : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700',
        loading && 'opacity-60 cursor-not-allowed',
      )}
    >
      {revealed ? '🔓 Revealed' : `🔒 Reveal to ${partnerName}`}
    </button>
  );
}
