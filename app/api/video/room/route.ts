import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createRoom, createToken }  from '@/lib/video/DailyService';
import { BASE_DURATION_MINUTES }    from '@/lib/video/types';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/video/room — create room + call record + broadcast ring ────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId, recipientId } = await request.json().catch(() => ({}));
  if (!conversationId || !recipientId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 422 });
  }

  // Verify participant
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();
  if (!conv || ![conv.user_a_id, conv.user_b_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Check no active call already exists for this conversation
  const { data: active } = await supabase
    .from('video_calls')
    .select('id')
    .eq('conversation_id', conversationId)
    .in('status', ['ringing', 'active'])
    .maybeSingle();

  if (active) {
    return NextResponse.json({ error: 'A call is already active in this conversation' }, { status: 409 });
  }

  // Create Daily.co room (max 15 min base + 3 extensions = 75 min max)
  const room = await createRoom({ maxDurationSeconds: 75 * 60, enableRecordingPrev: false });

  // Create initiator token (owner)
  const { data: initiatorProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const token = await createToken({
    roomName:         room.name,
    userId:           user.id,
    userName:         initiatorProfile?.display_name ?? 'You',
    isOwner:          true,
    expiresInSeconds: 75 * 60 + 300,
  });

  // Insert call record
  const { data: callRecord, error: insertErr } = await supabase
    .from('video_calls')
    .insert({
      conversation_id: conversationId,
      initiator_id:    user.id,
      recipient_id:    recipientId,
      daily_room_name: room.name,
      daily_room_url:  room.url,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Send ring notification via Realtime broadcast
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name, photos(url, display_order)')
    .eq('id', user.id)
    .single();

  const photos = (myProfile?.photos ?? []).sort((a: any, b: any) => a.display_order - b.display_order);

  await supabase.channel(`ring:${recipientId}`).send({
    type:    'broadcast',
    event:   'ring',
    payload: {
      callId:         callRecord.id,
      conversationId,
      initiatorId:    user.id,
      initiatorName:  myProfile?.display_name ?? 'Someone',
      initiatorPhoto: photos[0]?.url ?? null,
    },
  });

  return NextResponse.json({
    callId: callRecord.id,
    roomConfig: {
      roomName:  room.name,
      roomUrl:   room.url,
      token,
      expiresAt: Date.now() + 75 * 60 * 1000,
    },
  }, { status: 201 });
}
