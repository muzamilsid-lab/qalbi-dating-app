import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── GET /api/conversations ───────────────────────────────────────────────────

export async function GET() {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      partner_a:profiles!conversations_user_a_id_fkey ( id, display_name, is_verified,
        photos ( url, display_order ) ),
      partner_b:profiles!conversations_user_b_id_fkey ( id, display_name, is_verified,
        photos ( url, display_order ) ),
      last_msg:messages!conversations_last_message_id_fkey ( content_type, sent_at, sender_id )
    `)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('last_activity_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data });
}
