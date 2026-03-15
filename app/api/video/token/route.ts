import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createToken }              from '@/lib/video/DailyService';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/video/token — generate recipient token + update status ─────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { callId } = await request.json().catch(() => ({}));
  if (!callId) return NextResponse.json({ error: 'callId required' }, { status: 400 });

  const { data: callRecord } = await supabase
    .from('video_calls')
    .select('*')
    .eq('id', callId)
    .single();

  if (!callRecord) return NextResponse.json({ error: 'Call not found' }, { status: 404 });

  if (![callRecord.initiator_id, callRecord.recipient_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  if (callRecord.status === 'declined' || callRecord.status === 'missed') {
    return NextResponse.json({ error: 'Call is no longer active' }, { status: 410 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const token = await createToken({
    roomName:         callRecord.daily_room_name,
    userId:           user.id,
    userName:         profile?.display_name ?? 'User',
    isOwner:          callRecord.initiator_id === user.id,
    expiresInSeconds: 75 * 60 + 300,
  });

  // Recipient accepting — update status
  if (callRecord.recipient_id === user.id && callRecord.status === 'ringing') {
    await supabase
      .from('video_calls')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', callId);
  }

  return NextResponse.json({
    roomConfig: {
      roomName:  callRecord.daily_room_name,
      roomUrl:   callRecord.daily_room_url,
      token,
      expiresAt: Date.now() + 75 * 60 * 1000,
    },
  });
}
