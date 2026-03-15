'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PresenceState }from '../types';

const HEARTBEAT_INTERVAL_MS = 30_000;
const AWAY_AFTER_MS         = 90_000; // 1.5 min without heartbeat = away

interface UsePresenceOptions {
  conversationId: string;
  myUserId: string;
  partnerId: string;
}

export function usePresence({ conversationId, myUserId, partnerId }: UsePresenceOptions) {
  const supabase             = createClient();
  const [partnerPresence, setPartnerPresence] = useState<PresenceState>({
    userId:     partnerId,
    online:     false,
    lastSeenAt: null,
  });

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const broadcast = useCallback((online: boolean) => {
    channelRef.current?.track({
      userId:    myUserId,
      online,
      seenAt:    new Date().toISOString(),
    });
  }, [myUserId]);

  useEffect(() => {
    const channel = supabase.channel(`presence:${conversationId}`, {
      config: { presence: { key: myUserId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; online: boolean; seenAt: string }>();
        const partnerStates = Object.values(state)
          .flat()
          .filter(s => s.userId === partnerId);

        if (partnerStates.length === 0) {
          setPartnerPresence(p => ({ ...p, online: false }));
          return;
        }

        const latest = partnerStates.sort(
          (a, b) => new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime()
        )[0];

        const seenAt  = new Date(latest.seenAt);
        const isOnline = latest.online && (Date.now() - seenAt.getTime()) < AWAY_AFTER_MS;

        setPartnerPresence({
          userId:     partnerId,
          online:     isOnline,
          lastSeenAt: seenAt,
        });
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === partnerId) {
          setPartnerPresence(p => ({ ...p, online: true, lastSeenAt: new Date() }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === partnerId) {
          setPartnerPresence(p => ({ ...p, online: false }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') broadcast(true);
      });

    channelRef.current = channel;

    // Heartbeat
    heartbeatRef.current = setInterval(() => broadcast(true), HEARTBEAT_INTERVAL_MS);

    // Notify offline on page hide
    const handleVisibility = () => {
      broadcast(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      broadcast(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [conversationId, myUserId, partnerId]);

  return { partnerPresence };
}
