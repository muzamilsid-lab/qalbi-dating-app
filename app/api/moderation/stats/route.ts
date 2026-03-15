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

async function requireModerator(userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'moderator' || data?.role === 'admin';
}

// ─── GET /api/moderation/stats ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = makeUserSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = await requireModerator(user.id);
  if (!isMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = getAdmin();

  const [pending, approved, rejected, reports, suspensions] = await Promise.all([
    admin.from('moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    admin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('active_suspensions').select('*', { count: 'exact', head: true }),
  ]);

  // Items reviewed today by this moderator
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { count: reviewedToday } = await admin
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('reviewed_by', user.id)
    .gte('reviewed_at', today.toISOString());

  return NextResponse.json({
    queue: {
      pending:  pending.count  ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
    },
    reports:         reports.count     ?? 0,
    activeSuspensions: suspensions.count ?? 0,
    reviewedToday,
  });
}
