'use client';

import { useCallback, useState } from 'react';
import { motion }                from 'framer-motion';
import clsx                      from 'clsx';

interface Props {
  enabled:   boolean;
  isPremium: boolean;
  onUpgrade?: () => void;
}

export function IncognitoToggle({ enabled, isPremium, onUpgrade }: Props) {
  const [active,  setActive]  = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (!isPremium) { onUpgrade?.(); return; }
    if (loading) return;

    setLoading(true);
    setError(null);

    const res = await fetch('/api/settings/incognito', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled: !active }),
    });

    if (res.ok) {
      setActive((a: boolean) => !a);
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: 'Failed' }));
      setError(msg);
    }
    setLoading(false);
  }, [active, loading, isPremium, onUpgrade]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-xl">
            🕵️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white text-sm">Incognito Mode</p>
              {!isPremium && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-900/60 text-amber-400 font-medium">
                  Gold
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              {active
                ? 'Only people you like can see you'
                : 'Your profile appears in discovery as usual'}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={toggle}
          disabled={loading}
          className={clsx(
            'relative w-12 h-6 rounded-full transition-colors duration-200',
            active ? 'bg-purple-600' : 'bg-neutral-700',
            loading && 'opacity-60 cursor-not-allowed',
            !isPremium && 'cursor-pointer',
          )}
        >
          <motion.div
            layout
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
            animate={{ left: active ? '26px' : '2px' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </button>
      </div>

      {active && (
        <div className="rounded-xl bg-purple-950/30 border border-purple-800/40 px-4 py-3 text-xs text-purple-300">
          🕵️ You're invisible. Your last active time shows as "24+ hours ago" to others.
          Only profiles you've liked can see you.
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  );
}
