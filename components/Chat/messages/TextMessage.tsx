'use client';

import { TextPayload } from '../types';

// Linkify URLs and @mentions
function linkify(text: string): React.ReactNode[] {
  const URL_RE    = /https?:\/\/[^\s]+/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 opacity-90 hover:opacity-100"
        onClick={e => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    last = URL_RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

interface Props {
  payload: TextPayload;
  isMine: boolean;
}

export function TextMessage({ payload, isMine }: Props) {
  return (
    <p
      className={`
        text-sm leading-relaxed break-words whitespace-pre-wrap
        ${isMine ? 'text-white' : 'text-[var(--color-text-primary)]'}
      `}
    >
      {linkify(payload.text)}
    </p>
  );
}
