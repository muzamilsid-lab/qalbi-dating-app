import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';

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

// ─── Moderator role check ─────────────────────────────────────────────────────

async function requireModerator(userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'moderator' || data?.role === 'admin';
}

// ─── GET /api/moderation/queue ─────────────────────────────────────────────────
// Query params: status (default: pending), content_type, limit (default: 25), offset

export async function GET(request: NextRequest) {
  const supabase = makeUserSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = await requireModerator(user.id);
  if (!isMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url    = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const type   = url.searchParams.get('content_type');
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '25'), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  const admin = getAdmin();
  let query = admin
    .from('moderation_queue')
    .select(`
      *,
      user:user_id (
        id,
        display_name,
        avatar_url,
        created_at
      )
    `, { count: 'exact' })
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('content_type', type);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data, total: count, limit, offset });
}

// ─── GET /api/moderation/queue/stats ─────────────────────────────────────────

export async function HEAD(request: NextRequest) {
  // Used as a stats ping — returns queue counts per status in headers
  const supabase = makeUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const isMod = await requireModerator(user.id);
  if (!isMod) return new NextResponse(null, { status: 403 });

  const admin = getAdmin();
  const { count } = await admin
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Pending-Count': String(count ?? 0) },
  });
}
