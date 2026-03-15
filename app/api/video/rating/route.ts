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

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { callId, rating, unmatchAfter, note } = await request.json().catch(() => ({}));

  if (!callId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating must be 1–5' }, { status: 422 });
  }

  const { error } = await supabase.from('call_ratings').upsert({
    call_id:          callId,
    user_id:          user.id,
    rating,
    unmatched_after:  !!unmatchAfter,
    note:             note?.slice(0, 500) ?? null,
  }, { onConflict: 'call_id,user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
