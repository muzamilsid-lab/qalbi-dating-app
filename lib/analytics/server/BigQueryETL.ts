/**
 * BigQueryETL — daily export of analytics_events to Google BigQuery.
 *
 * Runs once per day. Uses the previous day's events (UTC midnight → midnight).
 * Creates the table if it doesn't exist; appends new rows.
 *
 * Environment variables:
 *   BIGQUERY_PROJECT_ID      - GCP project ID
 *   BIGQUERY_DATASET         - dataset name (default: qalbi_analytics)
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON - service account key JSON string
 */

import { BigQuery } from '@google-cloud/bigquery';
import { createClient } from '@supabase/supabase-js';

// ─── BigQuery client ──────────────────────────────────────────────────────────

function getBigQuery(): BigQuery {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');

  const credentials = JSON.parse(credsJson);
  return new BigQuery({
    projectId:   process.env.BIGQUERY_PROJECT_ID!,
    credentials,
  });
}

const DATASET  = process.env.BIGQUERY_DATASET ?? 'qalbi_analytics';
const TABLE_EVENTS = 'events';
const TABLE_DAILY  = 'daily_metrics';

// ─── Schema definitions ───────────────────────────────────────────────────────

const EVENTS_SCHEMA = [
  { name: 'id',           type: 'STRING',    mode: 'REQUIRED' },
  { name: 'event_name',   type: 'STRING',    mode: 'REQUIRED' },
  { name: 'user_id',      type: 'STRING',    mode: 'NULLABLE' },
  { name: 'anonymous_id', type: 'STRING',    mode: 'NULLABLE' },
  { name: 'session_id',   type: 'STRING',    mode: 'NULLABLE' },
  { name: 'properties',   type: 'JSON',      mode: 'NULLABLE' },
  { name: 'source',       type: 'STRING',    mode: 'NULLABLE' },
  { name: 'channel',      type: 'STRING',    mode: 'NULLABLE' },
  { name: 'platform',     type: 'STRING',    mode: 'NULLABLE' },
  { name: 'created_at',   type: 'TIMESTAMP', mode: 'REQUIRED' },
];

const DAILY_SCHEMA = [
  { name: 'date',                    type: 'DATE',    mode: 'REQUIRED' },
  { name: 'dau',                     type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'new_signups',             type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'total_swipes',            type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'swipe_right_rate',        type: 'FLOAT',   mode: 'NULLABLE' },
  { name: 'total_matches',           type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'messages_sent',           type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'new_subscriptions',       type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'revenue_usd',             type: 'NUMERIC', mode: 'NULLABLE' },
];

// ─── Ensure dataset + table exist ─────────────────────────────────────────────

async function ensureTable(bq: BigQuery, tableId: string, schema: object[]) {
  const dataset = bq.dataset(DATASET);

  const [dsExists] = await dataset.exists();
  if (!dsExists) await dataset.create({ location: 'US' });

  const table = dataset.table(tableId);
  const [exists] = await table.exists();
  if (!exists) {
    await table.create({
      schema,
      timePartitioning: { type: 'DAY', field: tableId === TABLE_EVENTS ? 'created_at' : 'date' },
      requirePartitionFilter: false,
    });
  }
}

// ─── Export yesterday's events ────────────────────────────────────────────────

export async function exportEventsToBigQuery(date?: string): Promise<number> {
  const admin   = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const targetDate = date ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const dayStart   = `${targetDate}T00:00:00Z`;
  const dayEnd     = `${targetDate}T23:59:59.999Z`;

  const bq = getBigQuery();
  await ensureTable(bq, TABLE_EVENTS, EVENTS_SCHEMA);

  let totalRows = 0;
  const PAGE = 2000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from('analytics_events')
      .select('id, event_name, user_id, anonymous_id, session_id, properties, source, channel, platform, created_at')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at')
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;

    const rows = data.map(r => ({
      ...r,
      properties: r.properties ? JSON.stringify(r.properties) : null,
      created_at: r.created_at,
    }));

    await bq.dataset(DATASET).table(TABLE_EVENTS).insert(rows);
    totalRows += rows.length;
    offset    += PAGE;

    if (data.length < PAGE) break;
  }

  return totalRows;
}

// ─── Export daily metrics ─────────────────────────────────────────────────────

export async function exportDailyMetricsToBigQuery(date?: string): Promise<void> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const targetDate = date ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const { data } = await admin
    .from('daily_metrics')
    .select('*')
    .eq('date', targetDate)
    .single();

  if (!data) return;

  const bq = getBigQuery();
  await ensureTable(bq, TABLE_DAILY, DAILY_SCHEMA);
  await bq.dataset(DATASET).table(TABLE_DAILY).insert([data]);
}

// ─── Recompute daily_metrics for a given date ─────────────────────────────────

export async function recomputeDailyMetrics(date?: string): Promise<void> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const targetDate = date ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const dayStart   = `${targetDate}T00:00:00Z`;
  const dayEnd     = `${targetDate}T23:59:59.999Z`;

  // All events for the day
  const { data: events } = await admin
    .from('analytics_events')
    .select('event_name, user_id, session_id, source, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (!events?.length) return;

  // Compute aggregates in memory
  const uniqueUsers    = new Set<string>();
  const sessions       = new Map<string, { start: number; end: number }>();
  let totalSwipes = 0, swipesRight = 0, matches = 0, chats = 0, msgs = 0, calls = 0, subs = 0;

  const signupSources = { organic: 0, referral: 0, paid: 0 };

  events.forEach(e => {
    if (e.user_id) uniqueUsers.add(e.user_id);

    if (e.session_id) {
      const ts = new Date(e.created_at).getTime();
      const ex = sessions.get(e.session_id);
      if (!ex) sessions.set(e.session_id, { start: ts, end: ts });
      else { if (ts < ex.start) ex.start = ts; if (ts > ex.end) ex.end = ts; }
    }

    switch (e.event_name) {
      case 'swipe_left':
      case 'swipe_right':
      case 'super_like':
        totalSwipes++;
        if (e.event_name !== 'swipe_left') swipesRight++;
        break;
      case 'match_created':       matches++; break;
      case 'chat_opened':         chats++;   break;
      case 'message_sent':        msgs++;    break;
      case 'video_call_started':  calls++;   break;
      case 'signup_completed':
        subs++;
        if (e.source === 'paid')     signupSources.paid++;
        else if (e.source === 'referral') signupSources.referral++;
        else                         signupSources.organic++;
        break;
      case 'subscription_started': subs++; break;
    }
  });

  // Session duration stats
  const durations = Array.from(sessions.values())
    .map(s => (s.end - s.start) / 1000)
    .filter(d => d > 0 && d < 3600);   // ignore outliers

  const avg    = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

  // Revenue from Stripe data in subscriptions table
  const { data: revData } = await admin
    .from('daily_metrics')
    .select('revenue_usd')
    .eq('date', targetDate)
    .single();

  await admin.from('daily_metrics').upsert({
    date:                    targetDate,
    dau:                     uniqueUsers.size,
    new_signups:             subs,
    signups_organic:         signupSources.organic,
    signups_referral:        signupSources.referral,
    signups_paid:            signupSources.paid,
    total_sessions:          sessions.size,
    avg_session_seconds:     avg ? Math.round(avg) : null,
    median_session_seconds:  median ? Math.round(median) : null,
    total_swipes:            totalSwipes,
    swipes_right:            swipesRight,
    swipe_right_rate:        totalSwipes > 0 ? Math.round((swipesRight / totalSwipes) * 10000) / 10000 : null,
    total_matches:           matches,
    match_rate:              swipesRight > 0 ? Math.round((matches / swipesRight) * 10000) / 10000 : null,
    conversations_started:   chats,
    messages_sent:           msgs,
    video_calls_started:     calls,
    new_subscriptions:       subs,
    revenue_usd:             (revData as any)?.revenue_usd ?? 0,
    updated_at:              new Date().toISOString(),
  }, { onConflict: 'date' });
}
