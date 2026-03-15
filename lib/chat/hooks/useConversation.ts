'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient }    from '@/lib/supabase/client';
import { chatDB }          from '../db/ChatIndexedDB';
import { messageCipher }   from '../crypto/MessageCipher';
import { messageQueue }    from '../queue/MessageQueue';
import {
  DecryptedMessage, ContentType, MessageContent,
  ConversationWithPartner,
} from '../types';
import { encodeBase64 }    from 'tweetnacl-util';

const PAGE_SIZE = 40;

interface UseConversationOptions {
  conversationId: string;
  myUserId: string;
  disappearingDefault?: boolean;
}

interface SendOptions {
  contentType: ContentType;
  content: MessageContent;
  /** Override disappearing default for this message */
  disappearing?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversation({
  conversationId,
  myUserId,
  disappearingDefault = false,
}: UseConversationOptions) {
  const supabase = createClient();

  const [messages,     setMessages]     = useState<DecryptedMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationWithPartner | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const oldestSentAt  = useRef<Date | undefined>(undefined);

  // ── Decrypt a raw DB row ──────────────────────────────────────────────────

  const decryptRow = useCallback((row: any): DecryptedMessage | null => {
    try {
      let content: MessageContent;

      if (row.content_type === 'gif' || row.content_type === 'system') {
        // GIFs and system messages are not encrypted
        content = row.metadata as MessageContent;
      } else {
        const nonceB64      = (row.metadata as any).nonce as string;
        const ciphertextB64 = (row.metadata as any).ciphertext as string;
        if (!nonceB64 || !ciphertextB64) return null;
        content = messageCipher.decryptRaw(conversationId, ciphertextB64, nonceB64);
      }

      const msg: DecryptedMessage = {
        id:             row.id,
        conversationId: row.conversation_id,
        senderId:       row.sender_id,
        contentType:    row.content_type,
        content,
        status:         deriveStatus(row),
        sentAt:         new Date(row.sent_at),
        deliveredAt:    row.delivered_at ? new Date(row.delivered_at) : null,
        readAt:         row.read_at      ? new Date(row.read_at)      : null,
        expiresAt:      row.expires_at   ? new Date(row.expires_at)   : null,
        reactions:      [],
      };

      return msg;
    } catch {
      return null; // skip undecryptable messages silently
    }
  }, [conversationId]);

  // ── Load initial page from cache then network ─────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // 1. Serve from IndexedDB cache immediately
      const cached = await chatDB.getMessages(conversationId, PAGE_SIZE);
      if (!cancelled && cached.length > 0) {
        setMessages(cached);
        setLoading(false);
      }

      // 2. Load conversation metadata
      const { data: convData } = await supabase
        .from('conversations')
        .select(`
          *,
          partner_a:profiles!conversations_user_a_id_fkey (
            id, display_name, is_verified,
            photos (url, display_order),
            chat_privacy_settings (*)
          ),
          partner_b:profiles!conversations_user_b_id_fkey (
            id, display_name, is_verified,
            photos (url, display_order),
            chat_privacy_settings (*)
          )
        `)
        .eq('id', conversationId)
        .single();

      if (!cancelled && convData) {
        const partnerRaw = convData.user_a_id === myUserId ? convData.partner_b : convData.partner_a;
        const privRaw    = partnerRaw?.chat_privacy_settings?.[0];
        const photos     = (partnerRaw?.photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order);

        const conv: ConversationWithPartner = {
          id:                 convData.id,
          matchId:            convData.match_id,
          lastMessageId:      convData.last_message_id,
          lastActivityAt:     new Date(convData.last_activity_at),
          userAId:            convData.user_a_id,
          userBId:            convData.user_b_id,
          userAUnreadCount:   convData.user_a_unread_count,
          userBUnreadCount:   convData.user_b_unread_count,
          myUnreadCount:      convData.user_a_id === myUserId
                                ? convData.user_a_unread_count
                                : convData.user_b_unread_count,
          partner: {
            id:           partnerRaw?.id ?? '',
            displayName:  partnerRaw?.display_name ?? 'Unknown',
            photoUrl:     photos[0]?.url ?? null,
            isVerified:   partnerRaw?.is_verified ?? false,
            privacySettings: {
              readReceipts:        privRaw?.read_receipts        ?? true,
              disappearingDefault: privRaw?.disappearing_default ?? false,
              screenshotNotify:    privRaw?.screenshot_notify    ?? true,
            },
          },
        };

        setConversation(conv);
        await chatDB.putConversation(conv);
      }

      // 3. Fetch latest messages from network
      const { data: rows, error: fetchErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .is('unsent_at', null)
        .order('sent_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;

      if (fetchErr) {
        if (!cached.length) setError(fetchErr.message);
        setLoading(false);
        return;
      }

      const decrypted = (rows ?? []).map(decryptRow).filter(Boolean).reverse() as DecryptedMessage[];

      setMessages(decrypted);
      if (decrypted.length > 0) {
        oldestSentAt.current = decrypted[0].sentAt;
        await chatDB.putMessages(decrypted);
      }
      setHasMore((rows?.length ?? 0) >= PAGE_SIZE);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [conversationId, myUserId]);

  // ── Subscribe to realtime inserts / updates ───────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = decryptRow(payload.new);
          if (!msg) return;
          setMessages(prev => {
            // Replace optimistic message if local id matches
            const localIdx = prev.findIndex(m => m.localId === msg.localId);
            if (localIdx !== -1) {
              const next = [...prev];
              next[localIdx] = msg;
              return next;
            }
            // Deduplicate
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          chatDB.putMessage(msg);
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new;
          setMessages(prev =>
            prev.map(m => {
              if (m.id !== row.id) return m;
              const updated: DecryptedMessage = {
                ...m,
                status:      deriveStatus(row),
                deliveredAt: row.delivered_at ? new Date(row.delivered_at) : m.deliveredAt,
                readAt:      row.read_at      ? new Date(row.read_at)      : m.readAt,
              };
              chatDB.updateMessageStatus(m.id, {
                status:      updated.status,
                deliveredAt: updated.deliveredAt,
                readAt:      updated.readAt,
              });
              return updated;
            })
          );
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, decryptRow]);

  // ── Send a message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (opts: SendOptions): Promise<string> => {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const expiresAt = (opts.disappearing ?? disappearingDefault)
      ? new Date(Date.now() + 24 * 3600 * 1000)
      : null;

    // Optimistic insert
    const optimistic: DecryptedMessage = {
      id:             localId,
      localId,
      conversationId,
      senderId:       myUserId,
      contentType:    opts.contentType,
      content:        opts.content,
      status:         'queued',
      sentAt:         new Date(),
      deliveredAt:    null,
      readAt:         null,
      expiresAt,
      reactions:      [],
    };

    setMessages(prev => [...prev, optimistic]);
    await chatDB.putMessage(optimistic);

    await messageQueue.enqueue({
      localId,
      conversationId,
      senderId:    myUserId,
      contentType: opts.contentType,
      content:     opts.content,
      expiresAt,
    });

    return localId;
  }, [conversationId, myUserId, disappearingDefault]);

  // ── Load older messages (pagination) ─────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !oldestSentAt.current) return;
    setLoadingMore(true);

    const { data: rows } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .is('unsent_at', null)
      .lt('sent_at', oldestSentAt.current.toISOString())
      .order('sent_at', { ascending: false })
      .limit(PAGE_SIZE);

    const older = (rows ?? []).map(decryptRow).filter(Boolean).reverse() as DecryptedMessage[];

    if (older.length > 0) {
      oldestSentAt.current = older[0].sentAt;
      setMessages(prev => [...older, ...prev]);
      await chatDB.putMessages(older);
    }

    setHasMore((rows?.length ?? 0) >= PAGE_SIZE);
    setLoadingMore(false);
  }, [conversationId, loadingMore, hasMore, decryptRow]);

  // ── Unsend (within 5 min) ─────────────────────────────────────────────────

  const unsendMessage = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.senderId !== myUserId) return;

    const ageMs = Date.now() - msg.sentAt.getTime();
    if (ageMs > 5 * 60 * 1000) return; // 5-min window

    await supabase
      .from('messages')
      .update({ unsent_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', myUserId);

    setMessages(prev => prev.filter(m => m.id !== messageId));
    await chatDB.deleteMessage(messageId);
  }, [messages, myUserId]);

  // ── Enable/disable disappearing messages for this conversation ────────────

  const setDisappearing = useCallback(async (enabled: boolean) => {
    // Persist as a system message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id:       myUserId,
      content_type:    'system',
      metadata:        { event: enabled ? 'disappear_enabled' : 'disappear_disabled' },
    });
  }, [conversationId, myUserId]);

  // ── React to a message ────────────────────────────────────────────────────

  const reactToMessage = useCallback(async (messageId: string, emoji: string) => {
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const existing = m.reactions.find(r => r.emoji === emoji);
      const userReacted = existing?.reactorIds.includes(myUserId);

      const reactions = userReacted
        ? m.reactions
            .map(r => r.emoji !== emoji ? r : {
              ...r,
              count:      r.count - 1,
              reactorIds: r.reactorIds.filter(id => id !== myUserId),
              userReacted: false,
            })
            .filter(r => r.count > 0)
        : existing
          ? m.reactions.map(r => r.emoji !== emoji ? r : {
              ...r,
              count:      r.count + 1,
              reactorIds: [...r.reactorIds, myUserId],
              userReacted: true,
            })
          : [...m.reactions, { emoji, count: 1, reactorIds: [myUserId], userReacted: true }];

      return { ...m, reactions };
    }));

    // Persist via API (best-effort, ignore errors)
    void (async () => {
      try {
        await supabase.from('message_reactions').upsert(
          { message_id: messageId, user_id: myUserId, emoji },
          { onConflict: 'message_id,user_id,emoji' },
        );
      } catch { /* silent */ }
    })();
  }, [myUserId]);

  return {
    messages, conversation, loading, loadingMore, hasMore, error,
    sendMessage, loadMore, unsendMessage, setDisappearing, reactToMessage,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(row: any): DecryptedMessage['status'] {
  if (row.read_at)      return 'read';
  if (row.delivered_at) return 'delivered';
  if (row.sent_at)      return 'sent';
  return 'sending';
}
