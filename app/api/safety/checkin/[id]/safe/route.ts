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

// ─── POST /api/safety/checkin/[id]/safe — mark as safe ───────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('date_checkins')
    .update({
      status:       'safe',
      checked_in_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', user.id)   // RLS double-check
    .eq('status', 'pending'); // Only pending can be marked safe

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
