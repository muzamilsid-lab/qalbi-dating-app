'use client';

import { AnimatePresence, motion }  from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx }                     from 'clsx';
import { useConversation }          from '@/lib/chat/hooks/useConversation';
import { useTypingIndicator }       from '@/lib/chat/hooks/useTypingIndicator';
import { useReadReceipts }          from '@/lib/chat/hooks/useReadReceipts';
import { usePresence }              from '@/lib/chat/hooks/usePresence';
import { messageQueue }             from '@/lib/chat/queue/MessageQueue';
import { messageCipher }            from '@/lib/chat/crypto/MessageCipher';
import { screenshotDetector }       from '@/lib/chat/privacy/ScreenshotDetector';
import { extractUrls, fetchLinkPreview, LinkPreview } from '@/lib/chat/privacy/LinkSafetyChecker';
import { MessageList }              from './MessageList';
import { ContentType, MessageContent } from '@/lib/chat/types';
import { encodeBase64 }             from 'tweetnacl-util';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  conversationId:       string;
  myUserId:             string;
  myDisplayName:        string;
  /** Partner's identity public key (base64) — from key exchange on match */
  partnerPublicKey:     string;
  partnerId:            string;
  onBack:               () => void;
}

// ─── Typing dot animation ─────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2" aria-label="Partner is typing">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

// ─── Link preview card ────────────────────────────────────────────────────────

function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  if (!preview.safe || !preview.title) return null;
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:shadow-md transition-shadow max-w-[280px]"
    >
      {preview.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.image} alt="" className="w-full h-28 object-cover" />
      )}
      <div className="px-3 py-2">
        {preview.siteName && (
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            {preview.siteName}
          </p>
        )}
        <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
          {preview.title}
        </p>
      </div>
    </a>
  );
}

// ─── Input toolbar ────────────────────────────────────────────────────────────

interface InputBarProps {
  onSend: (text: string) => void;
  onKeyStroke: () => void;
  onStopTyping: () => void;
  disabled: boolean;
}

function InputBar({ onSend, onKeyStroke, onStopTyping, disabled }: InputBarProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    onStopTyping();
    if (ref.current) {
      ref.current.style.height = 'auto';
    }
  }, [text, disabled, onSend, onStopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onKeyStroke();
    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [onKeyStroke]);

  return (
    <div className="flex items-end gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex-1 relative rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] focus-within:border-rose-400 transition-colors">
        <textarea
          ref={ref}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          disabled={disabled}
          aria-label="Message input"
          className="w-full bg-transparent px-4 py-2.5 resize-none outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm leading-relaxed"
          style={{ maxHeight: 120 }}
        />
      </div>

      <motion.button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className={clsx(
          'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-sm',
          'disabled:opacity-40',
        )}
        whileTap={{ scale: 0.9 }}
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 rotate-45" fill="currentColor">
          <path d="M2 21L23 12 2 3v7l15 2-15 2z"/>
        </svg>
      </motion.button>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  displayName:  string;
  photoUrl:     string | null;
  isVerified:   boolean;
  isOnline:     boolean;
  lastSeenAt:   Date | null;
  typingLabel:  string | null;
  onBack:       () => void;
  onInfo:       () => void;
}

function ChatHeader({
  displayName, photoUrl, isVerified, isOnline, lastSeenAt, typingLabel, onBack, onInfo,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <button onClick={onBack} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-alt)] transition-colors" aria-label="Back">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>

      <div className="relative shrink-0">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
            {displayName[0]}
          </div>
        )}
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--color-surface)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="font-semibold text-[var(--color-text-primary)] text-sm truncate">
            {displayName}
          </p>
          {isVerified && (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="currentColor">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          )}
        </div>
        <AnimatePresence mode="wait">
          {typingLabel ? (
            <motion.p
              key="typing"
              className="text-xs text-rose-400 font-medium truncate"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {typingLabel}
            </motion.p>
          ) : (
            <motion.p
              key="status"
              className="text-xs text-[var(--color-text-muted)] truncate"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {isOnline
                ? 'Active now'
                : lastSeenAt
                ? `Last seen ${formatRelative(lastSeenAt)}`
                : 'Offline'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button onClick={onInfo} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-alt)] transition-colors" aria-label="Conversation info">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Main ChatView ────────────────────────────────────────────────────────────

export function ChatView({ conversationId, myUserId, myDisplayName, partnerPublicKey, partnerId, onBack }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);

  // Register shared secret
  useEffect(() => {
    try {
      messageCipher.registerSecret(conversationId, partnerPublicKey);
    } catch {
      // Key manager not yet initialised — will be retried on first send
    }
  }, [conversationId, partnerPublicKey]);

  // Attach message queue send function
  useEffect(() => {
    messageQueue.attach(
      async ({ localId, conversationId: cid, contentType, content, expiresAt }) => {
        const { ciphertext, nonceB64 } = messageCipher.encrypt(cid, content);
        const res = await fetch('/api/messages', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localId,
            conversationId: cid,
            contentType,
            ciphertext: encodeBase64(ciphertext),
            nonce:      nonceB64,
            expiresAt:  expiresAt?.toISOString() ?? null,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        return { serverId: data.serverId };
      },
      (localId, status, serverId) => {
        // Handled by useConversation's realtime subscription
      },
    );
    messageQueue.start();
    return () => messageQueue.stop();
  }, []);

  const {
    messages, conversation, loading, loadingMore, hasMore, error,
    sendMessage, loadMore, unsendMessage, reactToMessage,
  } = useConversation({ conversationId, myUserId });

  const { typingLabel, onKeyStroke, stopTyping } = useTypingIndicator({
    conversationId,
    myUserId,
    myDisplayName,
  });

  const { partnerPresence } = usePresence({ conversationId, myUserId, partnerId });
  const { observeMessage }  = useReadReceipts({
    conversationId,
    myUserId,
    partnerShowsReceipts: conversation?.partner.privacySettings.readReceipts ?? true,
  });

  // Screenshot detection
  useEffect(() => {
    if (!conversation?.partner.privacySettings.screenshotNotify) return;
    const cleanup = screenshotDetector.attach(conversationId, async (cid) => {
      await fetch('/api/screenshot', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationId: cid }),
      });
    });
    return cleanup;
  }, [conversationId, conversation?.partner.privacySettings.screenshotNotify]);

  // Convert DecryptedMessage → Message (the chat UI type)
  const uiMessages = messages.map(m => {
    // Map infrastructure types to the existing Chat UI component types
    const payload = m.content as any;
    return {
      id:        m.id,
      senderId:  m.senderId,
      type:      m.contentType as any,
      payload,
      status:    m.status as any,
      reactions: m.reactions.map(r => ({ emoji: r.emoji as any, count: r.count, userReacted: r.userReacted })),
      sentAt:    m.sentAt,
    };
  });

  const handleSend = useCallback(async (text: string) => {
    const content: MessageContent = { type: 'text', text };
    await sendMessage({ contentType: 'text', content });
  }, [sendMessage]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const partner = conversation?.partner;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header */}
      <ChatHeader
        displayName={partner?.displayName ?? '…'}
        photoUrl={partner?.photoUrl ?? null}
        isVerified={partner?.isVerified ?? false}
        isOnline={partnerPresence.online}
        lastSeenAt={partnerPresence.lastSeenAt}
        typingLabel={typingLabel}
        onBack={onBack}
        onInfo={() => setInfoOpen(true)}
      />

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 text-red-600 text-xs"
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
          >
            {error} — showing cached messages
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load-more button */}
      {hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs text-rose-400 font-medium hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      {/* Message list */}
      <MessageList
        messages={uiMessages as any}
        myId={myUserId}
        onReact={(msgId, emoji) => reactToMessage(msgId, emoji)}
        className="flex-1"
      />

      {/* Typing dots */}
      <AnimatePresence>
        {typingLabel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4"
          >
            <TypingDots />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <InputBar
        onSend={handleSend}
        onKeyStroke={onKeyStroke}
        onStopTyping={stopTyping}
        disabled={!!error}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
