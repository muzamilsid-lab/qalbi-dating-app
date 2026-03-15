'use client';

/**
 * AnalyticsClient — browser-side event tracker.
 *
 * Batches events locally and flushes to /api/analytics/track every 3s or
 * when the batch reaches 20 events. Falls back to sendBeacon on page unload.
 *
 * Generates a stable anonymous_id (localStorage) and a per-session session_id.
 */

import type { AnalyticsEvent, EventProperties, TrackedEvent } from './types';

// ─── Config ───────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 3_000;
const MAX_BATCH_SIZE    = 20;
const ANON_ID_KEY       = 'qalbi_anon_id';
const SESSION_ID_KEY    = 'qalbi_session_id';

// ─── ID helpers ───────────────────────────────────────────────────────────────

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreate(storage: Storage, key: string): string {
  let val = storage.getItem(key);
  if (!val) { val = uuid(); storage.setItem(key, val); }
  return val;
}

// ─── Singleton client ─────────────────────────────────────────────────────────

class AnalyticsClientImpl {
  private queue:     TrackedEvent[]   = [];
  private userId:    string | null    = null;
  private anonId:    string;
  private sessionId: string;
  private timer:     ReturnType<typeof setInterval> | null = null;
  private utmProps:  Partial<EventProperties> = {};

  constructor() {
    // Stable across page loads
    this.anonId    = typeof window !== 'undefined'
      ? getOrCreate(localStorage, ANON_ID_KEY)
      : uuid();

    // New each tab/session
    this.sessionId = typeof window !== 'undefined'
      ? getOrCreate(sessionStorage, SESSION_ID_KEY)
      : uuid();

    if (typeof window !== 'undefined') {
      this.parseUtm();
      this.startFlushTimer();
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushBeacon();
      });
      window.addEventListener('pagehide', () => this.flushBeacon());
    }
  }

  // ── UTM parsing ─────────────────────────────────────────────────────────

  private parseUtm() {
    try {
      const params = new URLSearchParams(window.location.search);
      const source  = params.get('utm_source');
      const medium  = params.get('utm_medium');
      const campaign = params.get('utm_campaign');
      if (source || medium || campaign) {
        this.utmProps = {
          source:  (medium === 'cpc' || medium === 'paid') ? 'paid'
                 : (medium === 'referral' || source === 'referral') ? 'referral'
                 : source ? 'organic' : 'unknown',
          channel: source ?? undefined,
          referrer: document.referrer || undefined,
        };
        // Persist for session so funnel keeps attribution
        sessionStorage.setItem('qalbi_utm', JSON.stringify(this.utmProps));
      } else {
        const stored = sessionStorage.getItem('qalbi_utm');
        if (stored) this.utmProps = JSON.parse(stored);
      }
    } catch { /* ignore */ }
  }

  // ── Identity ─────────────────────────────────────────────────────────────

  identify(userId: string) {
    this.userId = userId;
    // Flush any queued events with the now-known userId
    this.queue.forEach(e => { if (!e.userId) e.userId = userId; });
  }

  reset() {
    this.userId = null;
    this.sessionId = uuid();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_ID_KEY, this.sessionId);
    }
  }

  // ── Track ─────────────────────────────────────────────────────────────────

  track(event: AnalyticsEvent, properties: EventProperties = {}) {
    const e: TrackedEvent = {
      event,
      userId:      this.userId ?? undefined,
      anonymousId: this.anonId,
      sessionId:   this.sessionId,
      properties:  {
        platform: 'web',
        ...this.utmProps,
        ...properties,
      },
      timestamp: new Date().toISOString(),
    };

    this.queue.push(e);

    if (this.queue.length >= MAX_BATCH_SIZE) this.flush();
  }

  // ── Flush ─────────────────────────────────────────────────────────────────

  private startFlushTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);

    try {
      await fetch('/api/analytics/track', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ events: batch }),
      });
    } catch {
      // Re-queue on failure (don't lose events)
      this.queue.unshift(...batch);
    }
  }

  /** Use sendBeacon for page-unload reliability */
  private flushBeacon() {
    if (this.queue.length === 0 || typeof navigator === 'undefined') return;
    const batch = this.queue.splice(0);
    navigator.sendBeacon(
      '/api/analytics/track',
      new Blob([JSON.stringify({ events: batch })], { type: 'application/json' }),
    );
  }
}

// ─── Module-level singleton ───────────────────────────────────────────────────

declare global {
  interface Window { __qalbiAnalytics?: AnalyticsClientImpl; }
}

function getInstance(): AnalyticsClientImpl {
  if (typeof window === 'undefined') {
    // SSR stub
    return new AnalyticsClientImpl();
  }
  if (!window.__qalbiAnalytics) {
    window.__qalbiAnalytics = new AnalyticsClientImpl();
  }
  return window.__qalbiAnalytics;
}

export const analytics = {
  identify: (userId: string)                                      => getInstance().identify(userId),
  track:    (event: AnalyticsEvent, props?: EventProperties)      => getInstance().track(event, props),
  reset:    ()                                                     => getInstance().reset(),
  flush:    ()                                                     => getInstance().flush(),
};
