import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  );
}

// ─── GET /api/prompts — catalogue + user answers ──────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [catRes, userRes] = await Promise.all([
    supabase.from('prompts').select('*').eq('is_active', true).order('category'),
    supabase
      .from('profile_prompts')
      .select('*, prompt:prompts(*)')
      .eq('user_id', user.id)
      .order('order_index'),
  ]);

  if (catRes.error)  return NextResponse.json({ error: catRes.error.message },  { status: 500 });
  if (userRes.error) return NextResponse.json({ error: userRes.error.message }, { status: 500 });

  return NextResponse.json({ catalogue: catRes.data, userPrompts: userRes.data });
}

// ─── PUT /api/prompts — upsert all 3 prompt slots ────────────────────────────

export async function PUT(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { prompts: Array<{ promptId: number; answer: string; orderIndex: 0 | 1 | 2 }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompts } = body;

  // Validate
  if (!Array.isArray(prompts) || prompts.length > 3) {
    return NextResponse.json({ error: 'Invalid prompts array' }, { status: 422 });
  }
  for (const p of prompts) {
    if (typeof p.promptId !== 'number' || typeof p.orderIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid prompt shape' }, { status: 422 });
    }
    if (!p.answer?.trim() || p.answer.length > 250) {
      return NextResponse.json({ error: 'Answer must be 1–250 characters' }, { status: 422 });
    }
  }

  // Delete existing, re-insert
  await supabase.from('profile_prompts').delete().eq('user_id', user.id);

  if (prompts.length > 0) {
    const rows = prompts.map(p => ({
      user_id:     user.id,
      prompt_id:   p.promptId,
      answer:      p.answer.trim(),
      order_index: p.orderIndex,
    }));

    const { error: insertErr } = await supabase.from('profile_prompts').insert(rows);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ─── DELETE /api/prompts?slot=0 ───────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slot = parseInt(new URL(request.url).searchParams.get('slot') ?? '', 10);
  if (![0, 1, 2].includes(slot)) {
    return NextResponse.json({ error: 'slot must be 0, 1, or 2' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profile_prompts')
    .delete()
    .eq('user_id', user.id)
    .eq('order_index', slot);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
