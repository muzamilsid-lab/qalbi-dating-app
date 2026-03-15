'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { formatDateHeader } from './hooks/useRelativeTime';
import { Message, MessageGroup, MessageWithMeta, ReactionEmoji } from './types';

// ─── Group messages by calendar day + consecutive sender ─────────────────────

function buildGroups(messages: Message[], myId: string): MessageGroup[] {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentDate = '';
  let currentGroup: MessageGroup | null = null;

  messages.forEach((msg, i) => {
    const dateLabel = formatDateHeader(msg.sentAt);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      currentGroup = { date: dateLabel, messages: [] };
      groups.push(currentGroup);
    }

    const prev = messages[i - 1];
    const next = messages[i + 1];

    const isMine = msg.senderId === myId;
    const sameSenderAsPrev = prev?.senderId === msg.senderId;
    const sameSenderAsNext = next?.senderId === msg.senderId;
    // Also break group on day boundary
    const prevSameDay = prev ? formatDateHeader(prev.sentAt) === dateLabel : false;
    const nextSameDay = next ? formatDateHeader(next.sentAt) === dateLabel : false;

    const meta: MessageWithMeta = {
      ...msg,
      isMine,
      isGroupStart: !sameSenderAsPrev || !prevSameDay,
      isGroupEnd:   !sameSenderAsNext || !nextSameDay,
    };

    currentGroup!.messages.push(meta);
  });

  return groups;
}

// ─── Date header divider ──────────────────────────────────────────────────────

function DateHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-4" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
      <span className="text-[var(--color-text-muted)] text-xs font-medium shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

interface Props {
  messages: Message[];
  myId: string;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
  className?: string;
}

export function MessageList({ messages, myId, onReact, className }: Props) {
  const groups = buildGroups(messages, myId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const prevLength = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useLayoutEffect(() => {
    if (messages.length !== prevLength.current) {
      prevLength.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  // Initial scroll to bottom (instant)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, []);

  return (
    <div
      ref={listRef}
      className={`flex flex-col overflow-y-auto px-3 py-4 gap-1 ${className ?? ''}`}
      role="log"
      aria-label="Messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      {groups.map(group => (
        <div key={group.date} className="flex flex-col gap-1">
          <DateHeader label={group.date} />

          <AnimatePresence initial={false}>
            {group.messages.map(msg => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 28,
                  opacity: { duration: 0.2 },
                }}
                className="flex flex-col"
                style={{ marginTop: msg.isGroupStart ? 8 : 2 }}
              >
                <MessageBubble msg={msg} onReact={onReact} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}

      {/* Invisible scroll anchor */}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
