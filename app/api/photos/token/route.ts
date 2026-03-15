import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';
import { verifyPhotoToken }         from '@/lib/safety/PhotoTokenService';

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

// ─── GET /api/photos/token?t=... — proxy private/match photos ────────────────

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  // 1. Verify token signature + expiry
  const { ok, payload, error: tokenErr } = verifyPhotoToken(token);
  if (!ok || !payload) return new NextResponse('Forbidden', { status: 403 });

  // 2. Verify the requesting user matches the token's viewerId
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== payload.viewerId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const admin = getAdmin();

  // 3. Load photo + check access
  const { data: photo } = await admin
    .from('profile_photos')
    .select('id, user_id, storage_key, visibility')
    .eq('id', payload.photoId)
    .single();

  if (!photo) return new NextResponse('Not found', { status: 404 });

  // Owner always has access
  if (photo.user_id === user.id) {
    return proxyPhoto(photo.storage_key);
  }

  switch (photo.visibility) {
    case 'public': {
      return proxyPhoto(photo.storage_key);
    }
    case 'matches': {
      // Check they are matched (shared conversation exists and is not hidden)
      const { data: conv } = await admin
        .from('conversations')
        .select('id')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${photo.user_id}),` +
          `and(user_a_id.eq.${photo.user_id},user_b_id.eq.${user.id})`,
        )
        .eq('hidden_for_user_a', false)
        .eq('hidden_for_user_b', false)
        .single();
      if (!conv) return new NextResponse('Forbidden', { status: 403 });
      return proxyPhoto(photo.storage_key);
    }
    case 'private': {
      // Check explicit reveal
      const { data: reveal } = await admin
        .from('photo_reveals')
        .select('id')
        .eq('photo_id', photo.id)
        .eq('revealed_to', user.id)
        .single();
      if (!reveal) return new NextResponse('Forbidden', { status: 403 });
      return proxyPhoto(photo.storage_key);
    }
  }
}

// ─── Proxy the image bytes from Supabase Storage ─────────────────────────────

async function proxyPhoto(storageKey: string): Promise<NextResponse> {
  const admin = getAdmin();
  const { data, error } = await admin.storage.from('photos').download(storageKey);
  if (error || !data) return new NextResponse('Not found', { status: 404 });

  const buf         = await data.arrayBuffer();
  const contentType = data.type || 'image/jpeg';

  return new NextResponse(buf, {
    status:  200,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
