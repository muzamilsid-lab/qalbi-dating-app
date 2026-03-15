'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const TYPING_DEBOUNCE_MS = 3_000;   // show typing for 3s after last keystroke
const BROADCAST_THROTTLE = 1_500;   // don't re-broadcast more than once per 1.5s

interface UseTypingOptions {
  conversationId: string;
  myUserId: string;
  myDisplayName: string;
}

interface TypingUser {
  userId: string;
  displayName: string;
  since: number;
}

export function useTypingIndicator({ conversationId, myUserId, myDisplayName }: UseTypingOptions) {
  const supabase   = createClient();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const channelRef        = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef  = useRef<number>(0);
  const isTypingRef       = useRef(false);

  // ── Broadcast self typing ─────────────────────────────────────────────────

  const sendTyping = useCallback((typing: boolean) => {
    const now = Date.now();
    if (typing && now - lastBroadcastRef.current < BROADCAST_THROTTLE) return;
    lastBroadcastRef.current = now;

    channelRef.current?.send({
      type:    'broadcast',
      event:   'typing',
      payload: {
        userId:      myUserId,
        displayName: myDisplayName,
        isTyping:    typing,
      },
    });
  }, [myUserId, myDisplayName]);

  // ── Called on every keystroke ─────────────────────────────────────────────

  const onKeyStroke = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }

    // Reset the stop timer
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, TYPING_DEBOUNCE_MS);
  }, [sendTyping]);

  // ── Stop typing immediately (on send or blur) ─────────────────────────────

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
    }
  }, [sendTyping]);

  // ── Listen to partner typing events ───────────────────────────────────────

  useEffect(() => {
    const channel = supabase.channel(`typing:${conversationId}`);

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === myUserId) return; // ignore own echo

        if (payload.isTyping) {
          setTypingUsers(prev => {
            const exists = prev.find(u => u.userId === payload.userId);
            if (exists) {
              return prev.map(u =>
                u.userId === payload.userId ? { ...u, since: Date.now() } : u
              );
            }
            return [...prev, {
              userId:      payload.userId,
              displayName: payload.displayName,
              since:       Date.now(),
            }];
          });
        } else {
          setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Prune stale typing indicators (4s window)
    const pruneInterval = setInterval(() => {
      const cutoff = Date.now() - (TYPING_DEBOUNCE_MS + 1000);
      setTypingUsers(prev => prev.filter(u => u.since > cutoff));
    }, 2_000);

    return () => {
      stopTyping();
      clearInterval(pruneInterval);
      supabase.removeChannel(channel);
    };
  }, [conversationId, myUserId]);

  // ── Derived label ─────────────────────────────────────────────────────────

  let typingLabel: string | null = null;
  if (typingUsers.length === 1) {
    typingLabel = `${typingUsers[0].displayName} is typing…`;
  } else if (typingUsers.length === 2) {
    typingLabel = `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing…`;
  } else if (typingUsers.length > 2) {
    typingLabel = `${typingUsers.length} people are typing…`;
  }

  return { typingLabel, typingUsers, onKeyStroke, stopTyping };
}
