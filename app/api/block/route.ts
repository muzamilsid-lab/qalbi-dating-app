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

// ─── POST /api/block — block a user ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blockedUserId } = await request.json().catch(() => ({}));
  if (!blockedUserId)     return NextResponse.json({ error: 'blockedUserId required' }, { status: 400 });
  if (blockedUserId === user.id) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });

  const admin = getAdmin();

  // 1. Insert block (ignore duplicate)
  await admin.from('blocks').upsert(
    { blocker_id: user.id, blocked_id: blockedUserId },
    { onConflict: 'blocker_id,blocked_id' },
  );

  // 2. Delete any swipes between the two users so discovery is clean
  await admin.from('swipes')
    .delete()
    .or(`and(swiper_id.eq.${user.id},swipee_id.eq.${blockedUserId}),and(swiper_id.eq.${blockedUserId},swipee_id.eq.${user.id})`);

  // 3. Find shared conversation and soft-delete it from blocked user's view
  const { data: conv } = await admin
    .from('conversations')
    .select('id, user_a_id, user_b_id')
    .or(
      `and(user_a_id.eq.${user.id},user_b_id.eq.${blockedUserId}),` +
      `and(user_a_id.eq.${blockedUserId},user_b_id.eq.${user.id})`,
    )
    .single();

  if (conv) {
    // Mark hidden for the blocked user — they see nothing, blocker keeps access
    const hiddenCol = conv.user_a_id === blockedUserId ? 'hidden_for_user_a' : 'hidden_for_user_b';
    await admin.from('conversations')
      .update({ [hiddenCol]: true })
      .eq('id', conv.id);
  }

  return NextResponse.json({ success: true });
}

// ─── DELETE /api/block — unblock ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blockedUserId } = await request.json().catch(() => ({}));
  if (!blockedUserId) return NextResponse.json({ error: 'blockedUserId required' }, { status: 400 });

  await supabase.from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  return NextResponse.json({ success: true });
}
