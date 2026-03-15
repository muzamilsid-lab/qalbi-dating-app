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

// ─── POST /api/photos/[id]/reveal — reveal a private photo to a specific user ─

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { revealToUserId } = await request.json().catch(() => ({}));
  if (!revealToUserId) return NextResponse.json({ error: 'revealToUserId required' }, { status: 400 });

  // Verify ownership
  const { data: photo } = await supabase
    .from('profile_photos')
    .select('id, user_id, visibility')
    .eq('id', params.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  if (photo.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (photo.visibility !== 'private') return NextResponse.json({ error: 'Photo is not private' }, { status: 400 });

  await supabase.from('photo_reveals').upsert(
    { photo_id: params.id, owner_id: user.id, revealed_to: revealToUserId },
    { onConflict: 'photo_id,revealed_to' },
  );

  return NextResponse.json({ success: true });
}

// ─── DELETE /api/photos/[id]/reveal — revoke a reveal ────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { revokeFromUserId } = await request.json().catch(() => ({}));
  if (!revokeFromUserId) return NextResponse.json({ error: 'revokeFromUserId required' }, { status: 400 });

  await supabase.from('photo_reveals')
    .delete()
    .eq('photo_id', params.id)
    .eq('owner_id', user.id)
    .eq('revealed_to', revokeFromUserId);

  return NextResponse.json({ success: true });
}
