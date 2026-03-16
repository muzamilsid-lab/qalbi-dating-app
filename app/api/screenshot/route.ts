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

const SCREENSHOT_COOLDOWN_MS = 10_000; // max 1 notify per 10s per conversation
const lastNotify = new Map<string, number>();

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await request.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });

  // Cooldown per user+conversation
  const key       = `${user.id}:${conversationId}`;
  const lastTime  = lastNotify.get(key) ?? 0;
  if (Date.now() - lastTime < SCREENSHOT_COOLDOWN_MS) {
    return NextResponse.json({ success: true }); // silently drop
  }
  lastNotify.set(key, Date.now());

  // Check participant
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();
  if (!conv || ![conv.user_a_id, conv.user_b_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Record + send system message
  await Promise.all([
    supabase.from('screenshot_events').insert({
      conversation_id: conversationId,
      taker_id:        user.id,
    }),
    supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id:       user.id,
      content_type:    'system',
      metadata:        { event: 'screenshot', takerId: user.id },
    }),
  ]);

  return NextResponse.json({ success: true });
}
