import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Service-role client — lazy so env vars are read at request time, not build time
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const CONFIDENCE_THRESHOLD = 0.75; // flag if confidence > 75%

// ─── POST /api/video/moderate — AI frame moderation (internal) ────────────────

export async function POST(request: NextRequest) {
  // Validate internal secret (only our own AIFrameMonitor should call this)
  const secret = request.headers.get('x-moderation-secret');
  if (secret !== process.env.MODERATION_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { callId, participantUserId, frameDataUrl } =
    await request.json().catch(() => ({}));

  if (!callId || !participantUserId || !frameDataUrl) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 422 });
  }

  // ── Call AI moderation API ────────────────────────────────────────────────
  // Pluggable: replace with AWS Rekognition, Clarifai, or Sightengine.
  const result = await callModerationAPI(frameDataUrl);

  if (!result || result.safe) {
    return NextResponse.json({ safe: true });
  }

  // Upload frame
  let frameUrl: string | null = null;
  try {
    const base64 = frameDataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const path   = `ai-flags/${callId}/${participantUserId}-${Date.now()}.jpg`;
    await getServiceClient().storage
      .from('moderation-frames')
      .upload(path, buffer, { contentType: 'image/jpeg' });
    frameUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/moderation-frames/${path}`;
  } catch { /* best-effort */ }

  await getServiceClient().from('ai_moderation_flags').insert({
    call_id:          callId,
    flagged_user_id:  participantUserId,
    flag_type:        result.flagType ?? 'other',
    confidence:       result.confidence,
    frame_url:        frameUrl,
    action_taken:     'none',
  });

  return NextResponse.json({ safe: false, flagType: result.flagType });
}

// ─── Stub: replace with your moderation provider ─────────────────────────────

async function callModerationAPI(dataUrl: string): Promise<{
  safe: boolean;
  flagType?: string;
  confidence: number;
} | null> {
  const apiKey = process.env.SIGHTENGINE_API_KEY;
  if (!apiKey) return null;  // skip if not configured

  try {
    const base64 = dataUrl.split(',')[1];
    const form   = new FormData();
    form.append('media', new Blob([Buffer.from(base64, 'base64')], { type: 'image/jpeg' }), 'frame.jpg');
    form.append('models',  'nudity-2.0,violence');
    form.append('api_user', process.env.SIGHTENGINE_USER ?? '');
    form.append('api_secret', apiKey);

    const res  = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body:   form,
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const nudityConf  = data.nudity?.sexual_activity ?? 0;
    const violConf    = data.violence?.prob ?? 0;

    if (nudityConf > CONFIDENCE_THRESHOLD) {
      return { safe: false, flagType: 'nudity',   confidence: nudityConf };
    }
    if (violConf > CONFIDENCE_THRESHOLD) {
      return { safe: false, flagType: 'violence', confidence: violConf };
    }
    return { safe: true, confidence: Math.max(nudityConf, violConf) };
  } catch {
    return null;
  }
}
