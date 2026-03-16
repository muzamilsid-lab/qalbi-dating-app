import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { encodeBase64 }             from 'tweetnacl-util';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/messages — send a message ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    localId:        string;
    conversationId: string;
    contentType:    string;
    /** base64-encoded ciphertext */
    ciphertext:     string;
    /** base64 nonce */
    nonce:          string;
    /** public metadata (non-sensitive: image dimensions, waveform, etc.) */
    publicMeta?:    Record<string, unknown>;
    expiresAt?:     string | null;
  };

  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { localId, conversationId, contentType, ciphertext, nonce, publicMeta, expiresAt } = body;

  if (!localId || !conversationId || !contentType || !ciphertext || !nonce) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 });
  }

  // Verify participant
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();

  if (!conv || ![conv.user_a_id, conv.user_b_id].includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Build metadata: nonce + ciphertext + any public meta
  const metadata: Record<string, unknown> = {
    nonce,
    ciphertext,
    ...publicMeta,
  };

  const { data: msg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id:       user.id,
      content_type:    contentType,
      metadata,
      expires_at:      expiresAt ?? null,
    })
    .select('id, sent_at, delivered_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    serverId:    msg.id,
    localId,
    sentAt:      msg.sent_at,
    deliveredAt: msg.delivered_at,
  }, { status: 201 });
}
