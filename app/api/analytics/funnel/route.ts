import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { createClient }             from '@supabase/supabase-js';
import { getFunnelData }            from '@/lib/analytics/server/MetricsService';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

async function requireAdmin(userId: string): Promise<boolean> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

// ─── GET /api/analytics/funnel?days=30&source=organic ────────────────────────

export async function GET(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await requireAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') ?? '30');

  const data = await getFunnelData(days);
  return NextResponse.json(data);
}
