'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseReadReceiptsOptions {
  conversationId: string;
  myUserId: string;
  /** Respect partner's privacy setting */
  partnerShowsReceipts: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReadReceipts({
  conversationId,
  myUserId,
  partnerShowsReceipts,
}: UseReadReceiptsOptions) {
  const supabase       = createClient();
  const observerRef    = useRef<IntersectionObserver | null>(null);
  const pendingRef     = useRef<Set<string>>(new Set());
  const flushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flush batch of read message IDs to server ────────────────────────────

  const flush = useCallback(async () => {
    const ids = Array.from(pendingRef.current);
    if (ids.length === 0) return;
    pendingRef.current.clear();

    try {
      const readAt = new Date().toISOString();

      // Upsert into message_reads
      await supabase.from('message_reads').upsert(
        ids.map(id => ({ message_id: id, user_id: myUserId, read_at: readAt })),
        { onConflict: 'message_id,user_id' },
      );

      // Update messages.read_at (only for messages not sent by me)
      await supabase
        .from('messages')
        .update({ read_at: readAt })
        .in('id', ids)
        .neq('sender_id', myUserId)
        .is('read_at', null);

      // Reset unread count
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_a_id, user_b_id')
        .eq('id', conversationId)
        .single();

      if (conv) {
        const field = conv.user_a_id === myUserId
          ? 'user_a_unread_count'
          : 'user_b_unread_count';
        await supabase
          .from('conversations')
          .update({ [field]: 0 })
          .eq('id', conversationId);
      }
    } catch {
      // Re-enqueue on failure
      ids.forEach(id => pendingRef.current.add(id));
    }
  }, [conversationId, myUserId]);

  // ── Register a message element for intersection observation ──────────────

  const observeMessage = useCallback((
    el: HTMLElement | null,
    messageId: string,
    fromPartnerId: string,
    alreadyRead: boolean,
  ) => {
    if (!el || alreadyRead || fromPartnerId === myUserId) return;
    if (!observerRef.current) return;
    el.dataset.messageId = messageId;
    observerRef.current.observe(el);
  }, [myUserId]);

  // ── Set up IntersectionObserver ───────────────────────────────────────────

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const messageId = (entry.target as HTMLElement).dataset.messageId;
          if (!messageId) return;
          pendingRef.current.add(messageId);
          observerRef.current!.unobserve(entry.target);
        });

        // Debounce flush — 800ms after last observation
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(flush, 800);
      },
      { threshold: 0.5 },
    );

    return () => {
      observerRef.current?.disconnect();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flush(); // flush remaining on unmount
    };
  }, [flush]);

  return { observeMessage, flush };
}
