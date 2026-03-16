import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { deleteRoom }               from '@/lib/video/DailyService';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/video/end — end / decline / extend ────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { callId, action, reason } = await request.json().catch(() => ({}));
  if (!callId) return NextResponse.json({ error: 'callId required' }, { status: 400 });

  const { data: callRecord } = await supabase
    .from('video_calls')
    .select('*')
    .eq('id', callId)
    .single();

  if (!callRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (![callRecord.initiator_id, callRecord.recipient_id].includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (action === 'decline') {
    await supabase
      .from('video_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString(), ended_by_id: user.id })
      .eq('id', callId);

    // Notify initiator
    await supabase.channel(`ring:${callRecord.initiator_id}`).send({
      type:    'broadcast',
      event:   'ring_cancelled',
      payload: { callId },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'extend') {
    if (callRecord.extension_count >= 3) {
      return NextResponse.json({ error: 'Max extensions reached' }, { status: 409 });
    }
    await supabase
      .from('video_calls')
      .update({ extension_count: callRecord.extension_count + 1 })
      .eq('id', callId);
    return NextResponse.json({ success: true });
  }

  // action === 'end' (or any other)
  const duration = callRecord.started_at
    ? Math.floor((Date.now() - new Date(callRecord.started_at).getTime()) / 1000)
    : null;

  await supabase
    .from('video_calls')
    .update({
      status:           'ended',
      ended_at:         new Date().toISOString(),
      ended_by_id:      user.id,
      duration_seconds: duration,
    })
    .eq('id', callId);

  // Delete Daily.co room
  if (callRecord.daily_room_name) {
    await deleteRoom(callRecord.daily_room_name);
  }

  // System message in chat
  void (async () => {
    try {
      await supabase.from('messages').insert({
        conversation_id: callRecord.conversation_id,
        sender_id:       user.id,
        content_type:    'system',
        metadata:        {
          event:           'video_call_ended',
          callId,
          durationSeconds: duration,
        },
      });
    } catch { /* ignore */ }
  })();

  return NextResponse.json({ success: true });
}
