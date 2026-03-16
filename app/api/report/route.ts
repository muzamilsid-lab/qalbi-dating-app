import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { processReport }            from '@/lib/moderation/EscalationEngine';
import type { ReportReason }        from '@/lib/moderation/types';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

const VALID_REASONS = new Set<ReportReason>([
  'fake_profile', 'inappropriate_photos', 'harassment',
  'underage', 'spam', 'other',
]);

// ─── POST /api/report ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    reportedUserId?: string;
    reason?:        ReportReason;
    details?:       string;
    evidenceUrls?:  string[];
  };

  if (!body.reportedUserId) return NextResponse.json({ error: 'reportedUserId required' }, { status: 400 });
  if (!body.reason || !VALID_REASONS.has(body.reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }
  if (body.reportedUserId === user.id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
  }

  // Sanitize optional fields
  const details      = body.details?.slice(0, 1000) ?? null;
  const evidenceUrls = (body.evidenceUrls ?? []).slice(0, 5);

  // Verify reported user exists
  const { data: reportedUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', body.reportedUserId)
    .single();
  if (!reportedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Insert report (dedup constraint in DB will reject duplicate within 24h)
  const { data: report, error: insertErr } = await supabase
    .from('reports')
    .insert({
      reporter_id:      user.id,
      reported_user_id: body.reportedUserId,
      reason:           body.reason,
      details,
      evidence_urls:    evidenceUrls,
    })
    .select('id')
    .single();

  if (insertErr) {
    // Unique constraint = duplicate report
    if (insertErr.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Process escalation rules asynchronously (don't block response)
  processReport(report.id).catch(err =>
    console.error('[report] escalation error:', err),
  );

  return NextResponse.json({ success: true, reportId: report.id });
}
