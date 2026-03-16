import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';
import { applyAction }              from '@/lib/moderation/EscalationEngine';
import type { ActionTaken }         from '@/lib/moderation/types';

export const dynamic = 'force-dynamic';

function makeUserSupabase() {
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

async function requireModerator(userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'moderator' || data?.role === 'admin';
}

const VALID_ACTIONS = new Set<ActionTaken>([
  'none', 'content_removed', 'warning', 'temp_ban', 'perm_ban',
]);

// ─── POST /api/moderation/review ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeUserSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = await requireModerator(user.id);
  if (!isMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.queueId) return NextResponse.json({ error: 'queueId required' }, { status: 400 });
  if (!VALID_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  await applyAction({
    queueId:     body.queueId,
    moderatorId: user.id,
    action:      body.action as ActionTaken,
    note:        body.note,
    banExpires:  body.banExpires ? new Date(body.banExpires) : undefined,
  });

  return NextResponse.json({ success: true });
}
