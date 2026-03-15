import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import {
  recomputeDailyMetrics,
  exportEventsToBigQuery,
  exportDailyMetricsToBigQuery,
} from '@/lib/analytics/server/BigQueryETL';
import { computeChurnScores }       from '@/lib/analytics/server/ChurnPredictor';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── POST /api/analytics/etl — trigger daily ETL ─────────────────────────────
// Called by Vercel Cron: { "path": "/api/analytics/etl", "schedule": "0 2 * * *" }

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const date = body.date as string | undefined;   // override for backfill

  const results: Record<string, unknown> = {};

  // 1. Recompute daily metrics from raw events
  try {
    await recomputeDailyMetrics(date);
    results.daily_metrics = 'ok';
  } catch (err: any) {
    results.daily_metrics = `error: ${err.message}`;
  }

  // 2. Export to BigQuery (skip if not configured)
  if (process.env.BIGQUERY_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const eventsExported = await exportEventsToBigQuery(date);
      results.bigquery_events = eventsExported;
    } catch (err: any) {
      results.bigquery_events = `error: ${err.message}`;
    }

    try {
      await exportDailyMetricsToBigQuery(date);
      results.bigquery_daily = 'ok';
    } catch (err: any) {
      results.bigquery_daily = `error: ${err.message}`;
    }
  } else {
    results.bigquery = 'skipped (not configured)';
  }

  // 3. Compute churn scores
  try {
    const processed = await computeChurnScores();
    results.churn_scores = processed;
  } catch (err: any) {
    results.churn_scores = `error: ${err.message}`;
  }

  return NextResponse.json({ success: true, date: date ?? 'yesterday', ...results });
}

// ─── GET — status / last run info ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getAdmin();
  const { data } = await admin
    .from('daily_metrics')
    .select('date, updated_at')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ lastRun: data ?? null });
}
