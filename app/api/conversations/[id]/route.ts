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

// ─── GET /api/conversations/:id — messages page ───────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '40', 10), 80);
  const before = searchParams.get('before'); // ISO timestamp

  // Verify participant
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', params.id)
    .single();

  if (!conv || ![conv.user_a_id, conv.user_b_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .is('deleted_at', null)
    .is('unsent_at', null)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('sent_at', before);

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: (messages ?? []).reverse() });
}

// ─── PATCH /api/conversations/:id — mark read / toggle disappearing ───────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  if (body.action === 'mark_read') {
    const { data: conv } = await supabase
      .from('conversations')
      .select('user_a_id, user_b_id')
      .eq('id', params.id)
      .single();
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const field = conv.user_a_id === user.id ? 'user_a_unread_count' : 'user_b_unread_count';
    await supabase.from('conversations').update({ [field]: 0 }).eq('id', params.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ─── DELETE /api/conversations/:id — soft-delete for current user ─────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', params.id)
    .single();
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const field = conv.user_a_id === user.id ? 'user_a_deleted_at' : 'user_b_deleted_at';
  await supabase.from('conversations').update({ [field]: new Date().toISOString() }).eq('id', params.id);

  return NextResponse.json({ success: true });
}
