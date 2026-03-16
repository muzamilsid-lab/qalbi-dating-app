import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { callId, reason, frameDataUrl } = await request.json().catch(() => ({}));
  if (!callId || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 422 });

  let frameUrl: string | null = null;

  // Upload frame to Supabase Storage if provided
  if (frameDataUrl) {
    try {
      const base64   = frameDataUrl.split(',')[1];
      const buffer   = Buffer.from(base64, 'base64');
      const path     = `reports/${callId}/${user.id}-${Date.now()}.jpg`;
      const { data } = await supabase.storage
        .from('moderation-frames')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
      if (data) {
        const { data: url } = supabase.storage.from('moderation-frames').getPublicUrl(path);
        frameUrl = url.publicUrl;
      }
    } catch { /* best-effort */ }
  }

  const { error } = await supabase.from('call_reports').insert({
    call_id:     callId,
    reporter_id: user.id,
    reason,
    frame_url:   frameUrl,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
