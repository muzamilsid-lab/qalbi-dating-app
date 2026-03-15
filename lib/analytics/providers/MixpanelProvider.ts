/**
 * MixpanelProvider — server-side Mixpanel HTTP API integration.
 * Sends events to Mixpanel's /track endpoint in batches.
 * Used from API routes and server-side code only (never exposes project token to client).
 */

import type { TrackedEvent } from '../types';

const MIXPANEL_API = 'https://api.mixpanel.com';
const PROJECT_TOKEN = process.env.MIXPANEL_PROJECT_TOKEN;

// ─── Map internal event to Mixpanel payload ───────────────────────────────────

function toMixpanelEvent(e: TrackedEvent): object {
  return {
    event:      e.event,
    properties: {
      token:       PROJECT_TOKEN,
      distinct_id: e.userId ?? e.anonymousId,
      $insert_id:  `${e.anonymousId}-${e.timestamp}-${e.event}`,
      time:        Math.floor(new Date(e.timestamp).getTime() / 1000),
      $session_id: e.sessionId,
      mp_lib:      'server',
      ...e.properties,
    },
  };
}

// ─── Batch track ─────────────────────────────────────────────────────────────

export async function mixpanelTrack(events: TrackedEvent[]): Promise<void> {
  if (!PROJECT_TOKEN) return;   // gracefully skip if not configured

  const batches: TrackedEvent[][] = [];
  for (let i = 0; i < events.length; i += 50) batches.push(events.slice(i, i + 50));

  await Promise.all(batches.map(async batch => {
    const payload = Buffer.from(JSON.stringify(batch.map(toMixpanelEvent))).toString('base64');
    await fetch(`${MIXPANEL_API}/track?data=${encodeURIComponent(payload)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }).catch(err => console.error('[Mixpanel] track error:', err));
  }));
}

// ─── Identify / set user properties ──────────────────────────────────────────

export async function mixpanelIdentify(userId: string, props: Record<string, unknown>): Promise<void> {
  if (!PROJECT_TOKEN) return;

  const payload = [{
    $token:    PROJECT_TOKEN,
    $distinct_id: userId,
    $set:      props,
  }];

  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  await fetch(`${MIXPANEL_API}/engage?data=${encodeURIComponent(data)}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  }).catch(err => console.error('[Mixpanel] identify error:', err));
}
