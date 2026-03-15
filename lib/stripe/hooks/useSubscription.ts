'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient }  from '@/lib/supabase/client';
import type { SubscriptionRow, BillingInterval } from '../types';

// ─── State ────────────────────────────────────────────────────────────────────

interface UseSubscriptionState {
  subscription: SubscriptionRow | null;
  loading:      boolean;
  error:        string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription() {
  const supabase = createClient();

  const [s, setS] = useState<UseSubscriptionState>({
    subscription: null,
    loading:      true,
    error:        null,
  });

  // ── Load subscription row ────────────────────────────────────────────────

  const load = useCallback(async () => {
    setS(p => ({ ...p, loading: true, error: null }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setS({ subscription: null, loading: false, error: null }); return; }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setS({
      subscription: (data as SubscriptionRow | null) ?? null,
      loading:      false,
      error:        error && error.code !== 'PGRST116' ? error.message : null,
    });
  }, []);

  useEffect(() => { load(); }, []);

  // ── Realtime sync — listen for subscription updates ──────────────────────

  useEffect(() => {
    let userId: string;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;

      supabase
        .channel('subscription-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
          () => { load(); },
        )
        .subscribe();
    });

    return () => { supabase.removeAllChannels(); };
  }, []);

  // ── Checkout: redirect to Stripe ─────────────────────────────────────────

  const startCheckout = useCallback(async (priceEnvKey: string) => {
    const res = await fetch('/api/stripe/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ priceEnvKey }),
    });
    const { url, error } = await res.json();
    if (error) throw new Error(error);
    window.location.href = url;
  }, []);

  // ── Open Stripe Customer Portal ───────────────────────────────────────────

  const openPortal = useCallback(async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url, error } = await res.json();
    if (error) throw new Error(error);
    window.location.href = url;
  }, []);

  // ── Derived helpers ───────────────────────────────────────────────────────

  const plan   = s.subscription?.plan   ?? 'free';
  const status = s.subscription?.status ?? 'active';
  const isActive = status === 'active' || status === 'trialing';
  const isPaid   = isActive && plan !== 'free';
  const isPlus   = isActive && (plan === 'plus' || plan === 'gold');
  const isGold   = isActive && plan === 'gold';

  const renewsAt = s.subscription?.current_period_end
    ? new Date(s.subscription.current_period_end)
    : null;

  return {
    ...s,
    plan,
    status,
    isActive,
    isPaid,
    isPlus,
    isGold,
    renewsAt,
    cancelAtPeriodEnd: s.subscription?.cancel_at_period_end ?? false,
    startCheckout,
    openPortal,
    reload: load,
  };
}
