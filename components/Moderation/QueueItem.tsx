'use client';

import { useState } from 'react';
import { motion }   from 'framer-motion';
import clsx         from 'clsx';
import type { QueueItem as QueueItemType, ActionTaken } from '@/lib/moderation/types';

// ─── Action config ────────────────────────────────────────────────────────────

const ACTIONS: Array<{
  action:  ActionTaken;
  label:   string;
  color:   string;
  icon:    string;
  confirm?: string;
}> = [
  { action: 'none',            label: 'Approve',         color: 'bg-green-700 hover:bg-green-600',  icon: '✅' },
  { action: 'content_removed', label: 'Remove Content',  color: 'bg-amber-700 hover:bg-amber-600',  icon: '🗑️' },
  { action: 'warning',         label: 'Warn User',       color: 'bg-orange-700 hover:bg-orange-600',icon: '⚠️' },
  { action: 'temp_ban',        label: '7-Day Ban',       color: 'bg-red-700 hover:bg-red-600',      icon: '⛔', confirm: 'Temp ban this user for 7 days?' },
  { action: 'perm_ban',        label: 'Permanent Ban',   color: 'bg-red-950 hover:bg-red-900 border border-red-700', icon: '🔴', confirm: 'Permanently ban and anonymise this user?' },
];

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_COLORS = {
  ai:      'bg-blue-900 text-blue-300',
  report:  'bg-purple-900 text-purple-300',
  pattern: 'bg-amber-900 text-amber-300',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  item:     QueueItemType & { user?: { display_name: string; avatar_url: string | null; created_at: string } };
  onAction: (queueId: string, action: ActionTaken, note?: string) => Promise<void>;
}

export function QueueItemCard({ item, onAction }: Props) {
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleAction = async (action: ActionTaken, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(true);
    await onAction(item.id, action, note || undefined);
    setLoading(false);
  };

  const confidence   = item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '—';
  const isPriority   = item.priority >= 50;
  const isUnderage   = item.detection_reason?.toLowerCase().includes('underage');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={clsx(
        'rounded-2xl border bg-neutral-900 overflow-hidden',
        isPriority ? 'border-red-500/50' : 'border-neutral-800',
      )}
    >
      {/* Priority stripe */}
      {isPriority && (
        <div className={clsx('h-1', isUnderage ? 'bg-red-600' : 'bg-amber-500')} />
      )}

      <div className="p-4 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* User avatar */}
            <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden shrink-0">
              {item.user?.avatar_url && (
                <img src={item.user.avatar_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>

            <div>
              <p className="font-semibold text-white text-sm">
                {item.user?.display_name ?? item.user_id.slice(0, 8)}
              </p>
              <p className="text-xs text-neutral-500">
                Joined {item.user?.created_at
                  ? new Date(item.user.created_at).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 justify-end">
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', SOURCE_COLORS[item.detection_source])}>
              {item.detection_source.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300">
              {item.content_type}
            </span>
            {isPriority && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-900 text-red-300">
                PRIORITY
              </span>
            )}
          </div>
        </div>

        {/* Detection info */}
        <div className="rounded-xl bg-neutral-800 p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-neutral-300">Detection</p>
            <p className="text-xs text-neutral-500">Confidence: <span className="text-white font-mono">{confidence}</span></p>
          </div>
          <p className="text-neutral-400">{item.detection_reason}</p>
        </div>

        {/* Labels (expandable) */}
        {item.raw_labels && item.raw_labels.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              {expanded ? '▲ Hide' : '▼ Show'} {item.raw_labels.length} label{item.raw_labels.length !== 1 ? 's' : ''}
            </button>
            {expanded && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.raw_labels.map((l, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-400 font-mono"
                  >
                    {l.name} {(l.confidence * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Moderator note */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add note (optional)"
          rows={2}
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white px-3 py-2 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500"
        />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(a => (
            <button
              key={a.action}
              disabled={loading}
              onClick={() => handleAction(a.action, a.confirm)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-colors',
                a.color,
                loading && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
