/**
 * AmplitudeProvider — server-side Amplitude HTTP API v2 integration.
 * Used as an alternative / dual-send alongside Mixpanel.
 */

import type { TrackedEvent } from '../types';

const AMPLITUDE_API = 'https://api2.amplitude.com/2/httpapi';
const API_KEY = process.env.AMPLITUDE_API_KEY;

// ─── Map to Amplitude event payload ──────────────────────────────────────────

function toAmplitudeEvent(e: TrackedEvent): object {
  return {
    event_type:     e.event,
    user_id:        e.userId ?? undefined,
    device_id:      e.userId ? undefined : e.anonymousId,
    session_id:     hashSession(e.sessionId),
    time:           new Date(e.timestamp).getTime(),
    event_properties: e.properties,
    platform:       e.properties.platform ?? 'web',
    app_version:    e.properties.app_version,
  };
}

// Amplitude requires numeric session IDs
function hashSession(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Batch track ─────────────────────────────────────────────────────────────

export async function amplitudeTrack(events: TrackedEvent[]): Promise<void> {
  if (!API_KEY) return;

  // Amplitude recommends batches of up to 2000 events
  const batches: TrackedEvent[][] = [];
  for (let i = 0; i < events.length; i += 200) batches.push(events.slice(i, i + 200));

  await Promise.all(batches.map(async batch => {
    await fetch(AMPLITUDE_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        api_key: API_KEY,
        events:  batch.map(toAmplitudeEvent),
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(err => console.error('[Amplitude] track error:', err));
  }));
}

// ─── Identify ─────────────────────────────────────────────────────────────────

export async function amplitudeIdentify(userId: string, props: Record<string, unknown>): Promise<void> {
  if (!API_KEY) return;

  await fetch('https://api2.amplitude.com/identify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      api_key:    API_KEY,
      identification: JSON.stringify([{
        user_id:         userId,
        user_properties: props,
      }]),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(err => console.error('[Amplitude] identify error:', err));
}
