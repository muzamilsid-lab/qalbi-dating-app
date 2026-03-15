'use client';

import { useCallback, useEffect, useRef } from 'react';
import { analytics }   from '../AnalyticsClient';
import type { AnalyticsEvent, EventProperties } from '../types';

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent, props?: EventProperties) => {
    analytics.track(event, props);
  }, []);

  return { track };
}

// ─── Session tracker ──────────────────────────────────────────────────────────
// Tracks session start and length, fires discovery_session_started automatically.

export function useSessionTracker() {
  const startTime  = useRef<number>(Date.now());
  const cardCount  = useRef<number>(0);
  const { track }  = useAnalytics();

  useEffect(() => {
    startTime.current = Date.now();
    track('app_opened');

    return () => {
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      // Flush on unmount with session length
      analytics.flush();
      // Note: session duration is stored server-side from event timestamps
    };
  }, []);

  const startDiscovery = useCallback(() => {
    cardCount.current = 0;
    track('discovery_session_started');
  }, [track]);

  const trackCard = useCallback((profileId: string) => {
    cardCount.current += 1;
    track('card_viewed', { profile_id: profileId, position: cardCount.current });
  }, [track]);

  return { startDiscovery, trackCard };
}

// ─── Signup funnel tracker ────────────────────────────────────────────────────

export function useSignupFunnel() {
  const { track } = useAnalytics();

  return {
    trackLanding:  useCallback(() => track('funnel_landing'),   [track]),
    trackStarted:  useCallback(() => { track('signup_started'); track('funnel_started'); }, [track]),
    trackPhoto:    useCallback(() => { track('profile_photo_added'); track('funnel_photo'); }, [track]),
    trackVerify:   useCallback(() => { track('verification_completed'); track('funnel_verify'); }, [track]),
    trackComplete: useCallback(() => { track('signup_completed'); track('funnel_complete'); }, [track]),
  };
}

// ─── Chat analytics ───────────────────────────────────────────────────────────

export function useChatAnalytics(conversationId: string) {
  const { track } = useAnalytics();
  const opened    = useRef(false);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      track('chat_opened', { conversation_id: conversationId });
    }
  }, [conversationId, track]);

  const trackMessage = useCallback((contentType: string, length: number) => {
    track('message_sent', { conversation_id: conversationId, content_type: contentType, message_length: length });
  }, [conversationId, track]);

  return { trackMessage };
}
