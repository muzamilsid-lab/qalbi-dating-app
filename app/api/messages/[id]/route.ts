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

// ─── DELETE /api/messages/:id — unsend (within 5 min) ────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: msg } = await supabase
    .from('messages')
    .select('sender_id, sent_at')
    .eq('id', params.id)
    .single();

  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (msg.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ageMs = Date.now() - new Date(msg.sent_at).getTime();
  if (ageMs > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Unsend window has expired (5 minutes)' }, { status: 409 });
  }

  const { error } = await supabase
    .from('messages')
    .update({ unsent_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ─── PATCH /api/messages/:id — mark delivered / read ─────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { action: string };

  if (body.action === 'mark_read') {
    const now = new Date().toISOString();

    await supabase
      .from('messages')
      .update({ read_at: now })
      .eq('id', params.id)
      .neq('sender_id', user.id)
      .is('read_at', null);

    await supabase.from('message_reads').upsert(
      { message_id: params.id, user_id: user.id, read_at: now },
      { onConflict: 'message_id,user_id' },
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
