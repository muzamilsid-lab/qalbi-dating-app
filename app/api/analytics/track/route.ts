import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';
import { mixpanelTrack }            from '@/lib/analytics/providers/MixpanelProvider';
import { amplitudeTrack }           from '@/lib/analytics/providers/AmplitudeProvider';
import type { TrackedEvent }        from '@/lib/analytics/types';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Events that also write to signup_funnel_events
const FUNNEL_STEPS = new Set(['funnel_landing', 'funnel_started', 'funnel_photo', 'funnel_verify', 'funnel_complete']);
const FUNNEL_STEP_NAME: Record<string, string> = {
  funnel_landing:  'landing',
  funnel_started:  'started',
  funnel_photo:    'photo',
  funnel_verify:   'verify',
  funnel_complete: 'complete',
};

// ─── POST /api/analytics/track ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Don't block the client — process async
  const body = await request.json().catch(() => null);
  if (!body?.events?.length) return NextResponse.json({ ok: true });

  const events = (body.events as TrackedEvent[]).slice(0, 100);   // cap at 100 per request

  // Optionally resolve auth user (may be null for anonymous events)
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // Attach server-known userId for authenticated users (don't trust client-sent userId)
  const resolvedEvents = events.map(e => ({
    ...e,
    userId: user?.id ?? e.userId,
  }));

  // Fire all persistence in parallel — never block client
  void Promise.all([
    persistToSupabase(resolvedEvents),
    mixpanelTrack(resolvedEvents),
    amplitudeTrack(resolvedEvents),
  ]).catch(err => console.error('[analytics/track]', err));

  return NextResponse.json({ ok: true });
}

async function persistToSupabase(events: TrackedEvent[]) {
  const admin = getAdmin();

  const rows = events.map(e => ({
    event_name:   e.event,
    user_id:      e.userId ?? null,
    anonymous_id: e.anonymousId,
    session_id:   e.sessionId,
    properties:   e.properties ?? {},
    source:       e.properties?.source ?? null,
    channel:      e.properties?.channel ?? null,
    app_version:  e.properties?.app_version ?? null,
    platform:     e.properties?.platform ?? null,
    created_at:   e.timestamp,
  }));

  await admin.from('analytics_events').insert(rows);

  // Write funnel events
  const funnelRows = events
    .filter(e => FUNNEL_STEPS.has(e.event))
    .map(e => ({
      anonymous_id: e.anonymousId,
      user_id:      e.userId ?? null,
      step:         FUNNEL_STEP_NAME[e.event] ?? e.event,
      source:       (e.properties?.source as string) ?? null,
      channel:      (e.properties?.channel as string) ?? null,
      referrer:     (e.properties?.referrer as string) ?? null,
      created_at:   e.timestamp,
    }));

  if (funnelRows.length > 0) {
    await admin.from('signup_funnel_events').insert(funnelRows);
  }
}
