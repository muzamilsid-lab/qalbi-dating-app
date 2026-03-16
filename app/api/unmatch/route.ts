import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

// ─── POST /api/unmatch ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await request.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });

  const admin = getAdmin();

  // Verify user is a participant
  const { data: conv } = await admin
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();

  if (!conv || ![conv.user_a_id, conv.user_b_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Record unmatch (idempotent)
  await admin.from('unmatches').upsert(
    { conversation_id: conversationId, initiator_id: user.id },
    { onConflict: 'conversation_id' },
  );

  // Hide conversation for both parties
  await admin.from('conversations')
    .update({ hidden_for_user_a: true, hidden_for_user_b: true })
    .eq('id', conversationId);

  // Delete the mutual swipe / match record so they can't see each other in discovery
  const otherId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;
  await admin.from('swipes')
    .delete()
    .or(
      `and(swiper_id.eq.${user.id},swipee_id.eq.${otherId}),` +
      `and(swiper_id.eq.${otherId},swipee_id.eq.${user.id})`,
    );

  return NextResponse.json({ success: true });
}
