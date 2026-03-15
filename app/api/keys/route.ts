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

// ─── GET /api/keys?userId=... — fetch a user's public key bundle ──────────────

export async function GET(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const targetUserId = new URL(request.url).searchParams.get('userId');
  if (!targetUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data, error } = await supabase
    .from('user_public_keys')
    .select('identity_key, signed_prekey, prekey_signature')
    .eq('user_id', targetUserId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Keys not found' }, { status: 404 });

  return NextResponse.json({
    userId:         targetUserId,
    identityKey:    data.identity_key,
    signedPrekey:   data.signed_prekey,
    prekeySignature: data.prekey_signature,
  });
}

// ─── PUT /api/keys — register / update own public key bundle ─────────────────

export async function PUT(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.identityKey || !body?.signedPrekey || !body?.prekeySignature) {
    return NextResponse.json({ error: 'Missing key fields' }, { status: 422 });
  }

  const { error } = await supabase.from('user_public_keys').upsert({
    user_id:          user.id,
    identity_key:     body.identityKey,
    signed_prekey:    body.signedPrekey,
    prekey_signature: body.prekeySignature,
    one_time_prekeys: body.oneTimePrekeys ?? [],
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
