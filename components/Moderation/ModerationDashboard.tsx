'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion }                  from 'framer-motion';
import clsx                                         from 'clsx';
import { QueueItemCard }                            from './QueueItem';
import { ModerationStats }                          from './ModerationStats';
import type { QueueItem, ActionTaken, ContentType, ModerationStatus } from '@/lib/moderation/types';

// ─── Filters ──────────────────────────────────────────────────────────────────

type StatusFilter = ModerationStatus | 'all';
type TypeFilter   = ContentType | 'all';

interface Filters {
  status: StatusFilter;
  type:   TypeFilter;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModerationDashboard() {
  const [items, setItems]   = useState<QueueItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({ status: 'pending', type: 'all' });
  const [error, setError]   = useState<string | null>(null);
  const offsetRef           = useRef(0);
  const LIMIT               = 25;

  const load = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const offset = reset ? 0 : offsetRef.current;
    const params = new URLSearchParams({
      status: filters.status === 'all' ? '' : filters.status,
      limit:  String(LIMIT),
      offset: String(offset),
    });
    if (filters.type !== 'all') params.set('content_type', filters.type);

    const res = await fetch(`/api/moderation/queue?${params}`);
    if (!res.ok) {
      setError('Failed to load queue');
      setLoading(false);
      return;
    }

    const { items: newItems, total: newTotal } = await res.json();
    setItems(prev => reset ? newItems : [...prev, ...newItems]);
    setTotal(newTotal ?? 0);
    offsetRef.current = reset ? LIMIT : offset + LIMIT;
    setLoading(false);
  }, [filters, loading]);

  // Reload when filters change
  useEffect(() => {
    offsetRef.current = 0;
    load(true);
  }, [filters]);

  const handleAction = useCallback(async (
    queueId: string,
    action:  ActionTaken,
    note?:   string,
  ) => {
    const res = await fetch('/api/moderation/review', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ queueId, action, note }),
    });
    if (!res.ok) {
      alert('Review failed — please try again');
      return;
    }
    // Remove item from current view optimistically
    setItems(prev => prev.filter(i => i.id !== queueId));
    setTotal(prev => Math.max(0, prev - 1));
  }, []);

  const hasMore = items.length < total;

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">Moderation Dashboard</h1>
        <p className="text-neutral-500 text-sm mt-0.5">Review flagged content and reports</p>
      </div>

      {/* Stats */}
      <ModerationStats />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
          {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilters(f => ({ ...f, status: s }))}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                filters.status === s
                  ? 'bg-purple-600 text-white'
                  : 'text-neutral-400 hover:text-white',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
          {(['all', 'photo', 'message', 'profile'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setFilters(f => ({ ...f, type: t }))}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                filters.type === t
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <span className="ml-auto self-center text-xs text-neutral-500">
          {total} item{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950 border border-red-700 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Queue */}
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="text-5xl">🎉</span>
          <p className="text-neutral-400 text-sm">
            {filters.status === 'pending'
              ? 'No pending items — queue is clear!'
              : 'No items match your filters'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {items.map(item => (
            <QueueItemCard
              key={item.id}
              item={item as any}
              onAction={handleAction}
            />
          ))}
        </AnimatePresence>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <button
          onClick={() => load(false)}
          className="w-full py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white text-sm transition-colors"
        >
          Load more ({total - items.length} remaining)
        </button>
      )}
    </div>
  );
}
