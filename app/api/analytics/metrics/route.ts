import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';
import {
  getOverviewMetrics,
  getDailyMetrics,
  getRevenueBreakdown,
} from '@/lib/analytics/server/MetricsService';
import { getCohortData }            from '@/lib/analytics/server/MetricsService';

export const dynamic = 'force-dynamic';

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

async function requireAdmin(userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

// ─── GET /api/analytics/metrics?type=overview|daily|cohorts|revenue ──────────

export async function GET(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = await requireAdmin(user.id);
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'overview';
  const days = parseInt(url.searchParams.get('days') ?? '30');

  switch (type) {
    case 'overview':
      return NextResponse.json(await getOverviewMetrics());
    case 'daily':
      return NextResponse.json(await getDailyMetrics(days));
    case 'cohorts':
      return NextResponse.json(await getCohortData(12));
    case 'revenue':
      return NextResponse.json(await getRevenueBreakdown());
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }
}
