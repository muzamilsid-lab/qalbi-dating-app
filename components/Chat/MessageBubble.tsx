'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { TextMessage }           from './messages/TextMessage';
import { ImageMessage }          from './messages/ImageMessage';
import { VoiceMessage }          from './messages/VoiceMessage';
import { VideoMessage }          from './messages/VideoMessage';
import { GifMessage }            from './messages/GifMessage';
import { LocationMessage }       from './messages/LocationMessage';
import { DateSuggestionMessage } from './messages/DateSuggestionMessage';
import { ReactionPicker, ReactionBadges } from './ReactionPicker';
import { useMessageGestures }    from './hooks/useMessageGestures';
import { formatFull }            from './hooks/useRelativeTime';
import { MessageWithMeta, ReactionEmoji } from './types';

// ─── Status icons ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: MessageWithMeta['status'] }) {
  if (status === 'sending') {
    return (
      <svg className="w-3 h-3 text-white/60 animate-spin" viewBox="0 0 24 24" fill="none" aria-label="Sending">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    );
  }
  if (status === 'sent') {
    return (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-label="Sent">
        <path d="M2 8l4 4 8-8"/>
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg viewBox="0 0 20 16" className="w-4 h-3.5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-label="Delivered">
        <path d="M1 8l4 4 8-8"/>
        <path d="M7 8l4 4 8-8"/>
      </svg>
    );
  }
  // read — filled pink ticks
  return (
    <svg viewBox="0 0 20 16" className="w-4 h-3.5 text-rose-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-label="Read">
      <path d="M1 8l4 4 8-8"/>
      <path d="M7 8l4 4 8-8"/>
    </svg>
  );
}

// ─── Tail SVG ─────────────────────────────────────────────────────────────────

function Tail({ isMine, color }: { isMine: boolean; color: string }) {
  // Points to bottom-right for own, bottom-left for theirs
  return (
    <svg
      viewBox="0 0 12 16"
      className={clsx('absolute bottom-0 w-3 h-4', isMine ? '-right-2' : '-left-2')}
      aria-hidden
    >
      {isMine ? (
        <path d="M0 16 Q12 16 12 0 L12 16 Z" fill={color} />
      ) : (
        <path d="M12 16 Q0 16 0 0 L0 16 Z" fill={color} />
      )}
    </svg>
  );
}

// ─── Content dispatcher ───────────────────────────────────────────────────────

function MessageContent({ msg }: { msg: MessageWithMeta }) {
  const { type, payload, isMine } = msg;

  // These types have their own container (no bubble wrapper needed)
  const noBubble = type === 'image' || type === 'gif' || type === 'video' ||
                   type === 'location' || type === 'date_suggestion';

  if (type === 'text')    return <TextMessage payload={payload as any} isMine={isMine} />;
  if (type === 'image')   return <ImageMessage payload={payload as any} isMine={isMine} />;
  if (type === 'voice')   return <VoiceMessage payload={payload as any} isMine={isMine} />;
  if (type === 'video')   return <VideoMessage payload={payload as any} />;
  if (type === 'gif')     return <GifMessage payload={payload as any} />;
  if (type === 'location')return <LocationMessage payload={payload as any} isMine={isMine} />;
  if (type === 'date_suggestion') return <DateSuggestionMessage payload={payload as any} isMine={isMine} />;
  return null;
}

// ─── Main bubble ──────────────────────────────────────────────────────────────

// Media types don't get the gradient background
const MEDIA_TYPES = new Set(['image', 'gif', 'video', 'location', 'date_suggestion']);

interface Props {
  msg: MessageWithMeta;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
}

export function MessageBubble({ msg, onReact }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { isMine, isGroupEnd, type, status, reactions, sentAt, id } = msg;

  const { showTimestamp, gestureProps } = useMessageGestures({
    onLongPress: () => setPickerOpen(true),
  });

  const handleReact = useCallback(
    (emoji: ReactionEmoji) => onReact(id, emoji),
    [id, onReact]
  );

  const isMedia = MEDIA_TYPES.has(type);

  // ── Bubble corner styles ───────────────────────────────────────────────────
  // isGroupEnd = show tail + sharp corner on that side
  const bubbleRadius = isMine
    ? isGroupEnd ? 'rounded-[20px] rounded-br-[4px]' : 'rounded-[20px]'
    : isGroupEnd ? 'rounded-[20px] rounded-bl-[4px]' : 'rounded-[20px]';

  const bubbleBg = isMedia ? '' : isMine
    ? 'bg-gradient-to-br from-rose-500 to-pink-500'
    : 'bg-slate-100 dark:bg-slate-800';

  const tailColor = isMine ? '#f43f5e' : undefined; // matches gradient start

  return (
    <div
      className={clsx(
        'flex flex-col max-w-[80%]',
        isMine ? 'items-end self-end' : 'items-start self-start'
      )}
    >
      {/* Bubble */}
      <motion.div
        className={clsx('relative', isMine ? 'ml-auto' : 'mr-auto')}
        {...gestureProps}
        layout
      >
        {/* Content wrapper */}
        <div
          className={clsx(
            'relative overflow-visible',
            !isMedia && [bubbleRadius, bubbleBg, 'px-3.5 py-2.5'],
            isMedia && bubbleRadius
          )}
          aria-label={
            type === 'text'
              ? `${isMine ? 'You' : 'Them'}: ${(msg.payload as any).text}`
              : `${isMine ? 'You' : 'Them'} sent a ${type} message`
          }
        >
          {/* Tail — only on last bubble in group */}
          {isGroupEnd && !isMedia && (
            <Tail isMine={isMine} color={isMine ? '#f43f5e' : (
              // Approximate dark/light slate — tailColor from CSS var not possible in SVG fill
              '#f1f5f9'  // slate-100 light; dark mode can be handled via inversion trick
            )} />
          )}

          <MessageContent msg={msg} />

          {/* Sending pulse overlay */}
          {status === 'sending' && (
            <motion.div
              className="absolute inset-0 rounded-[inherit] bg-white/20"
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              aria-hidden
            />
          )}
        </div>

        {/* Reaction picker (absolutely positioned above bubble) */}
        <ReactionPicker
          open={pickerOpen}
          align={isMine ? 'right' : 'left'}
          onSelect={handleReact}
          onClose={() => setPickerOpen(false)}
        />
      </motion.div>

      {/* Reactions row */}
      <AnimatePresence>
        {reactions.length > 0 && (
          <ReactionBadges
            reactions={reactions}
            isMine={isMine}
            onBadgeTap={(emoji) => onReact(id, emoji as ReactionEmoji)}
          />
        )}
      </AnimatePresence>

      {/* Status + timestamp row — only on group-end bubble */}
      {isGroupEnd && (
        <div className={clsx(
          'flex items-center gap-1 mt-1',
          isMine ? 'self-end' : 'self-start'
        )}>
          {/* Timestamp — shown on long-press or always for last mine message */}
          <AnimatePresence>
            {showTimestamp && (
              <motion.span
                className="text-[10px] text-[var(--color-text-muted)]"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
              >
                {formatFull(sentAt)}
              </motion.span>
            )}
          </AnimatePresence>

          {isMine && <StatusIcon status={status} />}
        </div>
      )}
    </div>
  );
}
