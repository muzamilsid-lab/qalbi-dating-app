import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import type { PhotoVisibility }     from '@/lib/safety/types';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

const VALID = new Set<string>(['public', 'matches', 'private']);

// ─── PUT /api/photos/[id]/visibility ──────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { visibility } = await request.json().catch(() => ({})) as { visibility?: PhotoVisibility };
  if (!visibility || !VALID.has(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
  }

  // RLS ensures only the owner can update
  const { error } = await supabase
    .from('profile_photos')
    .update({ visibility })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
