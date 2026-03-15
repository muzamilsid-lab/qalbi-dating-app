import { useEffect, useState } from 'react';

function format(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);

  if (diffSec < 10)  return 'Just now';
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHrs < 24)  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function useRelativeTime(isoString: string): string {
  const [label, setLabel] = useState(() => format(new Date(isoString)));

  useEffect(() => {
    const date = new Date(isoString);
    setLabel(format(date));

    // Refresh every 30s while the message is "recent"
    const interval = setInterval(() => {
      setLabel(format(date));
    }, 30_000);
    return () => clearInterval(interval);
  }, [isoString]);

  return label;
}

/** Full human-readable timestamp for long-press display */
export function formatFull(isoString: string): string {
  return new Date(isoString).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Group header label */
export function formatDateHeader(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';

  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });

  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
