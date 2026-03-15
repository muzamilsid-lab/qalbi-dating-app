'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DateCheckin, CreateCheckinPayload } from '../types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDateCheckin() {
  const supabase  = createClient();
  const [checkins, setCheckins] = useState<DateCheckin[]>([]);
  const [loading,  setLoading]  = useState(false);
  const promptTimerRef          = useRef<NodeJS.Timeout | null>(null);

  // ── Load active checkins ───────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('date_checkins')
      .select('*')
      .in('status', ['pending'])
      .order('date_starts_at', { ascending: true });
    setCheckins((data as DateCheckin[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  // ── Watch for pending check-ins that need prompting ───────────────────

  useEffect(() => {
    if (checkins.length === 0) return;

    checkins.forEach(checkin => {
      if (checkin.status !== 'pending' || checkin.checked_in_at) return;

      const promptAt = new Date(checkin.checkin_prompt_at).getTime();
      const now      = Date.now();
      const delay    = promptAt - now;

      if (delay <= 0) return; // Already past — server worker handles alert

      const timer = setTimeout(() => {
        // Re-fetch to confirm still pending
        load();
      }, Math.min(delay, 2_147_483_647)); // Max safe setTimeout value

      promptTimerRef.current = timer;
    });

    return () => {
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    };
  }, [checkins]);

  // ── Create a date check-in ────────────────────────────────────────────

  const createCheckin = useCallback(async (payload: CreateCheckinPayload): Promise<DateCheckin | null> => {
    const startsAt    = new Date(payload.dateStartsAt);
    const promptAt    = new Date(startsAt.getTime() + 2 * 3600_000);  // +2 hours

    const res = await fetch('/api/safety/checkin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        dateName:          payload.dateName,
        dateLocation:      payload.dateLocation,
        dateStartsAt:      payload.dateStartsAt,
        emergencyContact:  payload.emergencyContact,
        checkinPromptAt:   promptAt.toISOString(),
      }),
    });

    if (!res.ok) return null;
    const checkin = await res.json() as DateCheckin;
    setCheckins(prev => [checkin, ...prev]);
    return checkin;
  }, []);

  // ── Mark safe ─────────────────────────────────────────────────────────

  const markSafe = useCallback(async (checkinId: string) => {
    const res = await fetch(`/api/safety/checkin/${checkinId}/safe`, { method: 'POST' });
    if (!res.ok) return;
    setCheckins(prev =>
      prev.map(c => c.id === checkinId
        ? { ...c, status: 'safe', checked_in_at: new Date().toISOString() }
        : c,
      ),
    );
  }, []);

  // ── Cancel ────────────────────────────────────────────────────────────

  const cancelCheckin = useCallback(async (checkinId: string) => {
    await supabase.from('date_checkins')
      .update({ status: 'cancelled' })
      .eq('id', checkinId);
    setCheckins(prev => prev.filter(c => c.id !== checkinId));
  }, []);

  // ── Pending check-ins needing "I'm safe" response ─────────────────────

  const awaitingResponse = checkins.filter(c => {
    const promptAt = new Date(c.checkin_prompt_at).getTime();
    return c.status === 'pending' && !c.checked_in_at && Date.now() >= promptAt;
  });

  return {
    checkins,
    loading,
    awaitingResponse,
    createCheckin,
    markSafe,
    cancelCheckin,
    reload: load,
  };
}
