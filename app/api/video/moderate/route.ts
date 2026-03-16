import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONFIDENCE_THRESHOLD = 0.75;

// ─── POST /api/video/moderate — AI frame moderation (internal) ────────────────

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-moderation-secret');
  if (secret !== process.env.MODERATION_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { callId, participantUserId, frameDataUrl } =
    await request.json().catch(() => ({}));

  if (!callId || !participantUserId || !frameDataUrl) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 422 });
  }

  const result = await callModerationAPI(frameDataUrl);

  if (!result || result.safe) {
    return NextResponse.json({ safe: true });
  }

  // Dynamic import — never loaded at build time
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let frameUrl: string | null = null;
  try {
    const base64 = frameDataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const path   = `ai-flags/${callId}/${participantUserId}-${Date.now()}.jpg`;
    await supabase.storage
      .from('moderation-frames')
      .upload(path, buffer, { contentType: 'image/jpeg' });
    frameUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/moderation-frames/${path}`;
  } catch { /* best-effort */ }

  await supabase.from('ai_moderation_flags').insert({
    call_id:         callId,
    flagged_user_id: participantUserId,
    flag_type:       result.flagType ?? 'other',
    confidence:      result.confidence,
    frame_url:       frameUrl,
    action_taken:    'none',
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
  if (!apiKey) return null;

  try {
    const base64 = dataUrl.split(',')[1];
    const form   = new FormData();
    form.append('media', new Blob([Buffer.from(base64, 'base64')], { type: 'image/jpeg' }), 'frame.jpg');
    form.append('models',   'nudity-2.0,violence');
    form.append('api_user', process.env.SIGHTENGINE_USER ?? '');
    form.append('api_secret', apiKey);

    const res = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body:   form,
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;

    const data       = await res.json();
    const nudityConf = data.nudity?.sexual_activity ?? 0;
    const violConf   = data.violence?.prob ?? 0;

    if (nudityConf > CONFIDENCE_THRESHOLD) return { safe: false, flagType: 'nudity',   confidence: nudityConf };
    if (violConf   > CONFIDENCE_THRESHOLD) return { safe: false, flagType: 'violence', confidence: violConf   };
    return { safe: true, confidence: Math.max(nudityConf, violConf) };
  } catch {
    return null;
  }
}
