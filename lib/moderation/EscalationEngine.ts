import { createClient } from '@supabase/supabase-js';
import type { ActionTaken } from './types';

// ─── Admin client ─────────────────────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Suspension helpers ───────────────────────────────────────────────────────

export async function suspendUser(params: {
  userId:    string;
  type:      'auto_pending' | 'warning' | 'temp_ban' | 'perm_ban';
  reason:    string;
  expiresAt?: Date;
}) {
  const supabase = getAdmin();
  await supabase.from('user_suspensions').insert({
    user_id:    params.userId,
    type:       params.type,
    reason:     params.reason,
    expires_at: params.expiresAt?.toISOString() ?? null,
  });
}

export async function liftSuspension(suspensionId: string, moderatorId: string) {
  const supabase = getAdmin();
  await supabase.from('user_suspensions')
    .update({ lifted_by: moderatorId, lifted_at: new Date().toISOString() })
    .eq('id', suspensionId);
}

export async function isUserSuspended(userId: string): Promise<boolean> {
  const supabase = getAdmin();
  const { data } = await supabase
    .from('active_suspensions')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ─── Authorities notification ─────────────────────────────────────────────────

export interface ThreatPayload {
  reportId:          string;
  reporterUserId:    string;
  reportedUserId:    string;
  threatDescription: string;
  evidenceUrls:      string[];
  reportedAt:        string;
}

/**
 * Notify authorities for verified threat reports.
 * Integrates with your country's reporting API or a service like
 * NCMEC CyberTipline, IWF, etc.
 *
 * This implementation calls a configurable webhook endpoint — replace with
 * your jurisdiction's official API in production.
 */
export async function notifyAuthorities(payload: ThreatPayload): Promise<void> {
  const webhookUrl = process.env.AUTHORITIES_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[EscalationEngine] AUTHORITIES_WEBHOOK_URL not configured');
    return;
  }

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.AUTHORITIES_WEBHOOK_SECRET ?? ''}`,
    },
    body: JSON.stringify({
      source:    'qalbi_dating_app',
      timestamp: new Date().toISOString(),
      ...payload,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(err => {
    console.error('[EscalationEngine] authorities webhook error:', err);
    return null;
  });

  if (res && !res.ok) {
    console.error('[EscalationEngine] authorities webhook non-2xx:', res.status);
  }
}

// ─── Process a report and apply escalation rules ──────────────────────────────

export async function processReport(reportId: string): Promise<void> {
  const supabase = getAdmin();

  const { data: report } = await supabase
    .from('reports')
    .select('*, reporter:reporter_id(id), reported:reported_user_id(id)')
    .eq('id', reportId)
    .single();

  if (!report) return;

  // ── Rule 1: Underage report → immediate priority suspension ─────────────
  if (report.reason === 'underage') {
    await suspendUser({
      userId: report.reported_user_id,
      type:   'auto_pending',
      reason: 'Underage report — immediate suspension pending moderator review',
    });

    // Create priority queue item
    await supabase.from('moderation_queue').insert({
      content_type:     'profile',
      content_id:       report.reported_user_id,
      user_id:          report.reported_user_id,
      detection_source: 'report',
      detection_reason: 'Underage user report — URGENT',
      confidence:       1.0,
      status:           'pending',
      priority:         100,   // highest priority
      action_taken:     'none',
    });

    return;
  }

  // ── Rule 2: Harassment/threat → notify authorities if details provided ───
  if (report.reason === 'harassment' && report.details?.length > 20) {
    await notifyAuthorities({
      reportId:          report.id,
      reporterUserId:    report.reporter_id,
      reportedUserId:    report.reported_user_id,
      threatDescription: report.details ?? '',
      evidenceUrls:      report.evidence_urls ?? [],
      reportedAt:        report.created_at,
    });
  }

  // ── Rule 3: 3 unique reporters → auto-suspend (also done via DB trigger) ─
  const { count } = await supabase
    .from('reports')
    .select('reporter_id', { count: 'exact', head: true })
    .eq('reported_user_id', report.reported_user_id)
    .in('status', ['pending', 'investigating']);

  if ((count ?? 0) >= 3) {
    const alreadySuspended = await isUserSuspended(report.reported_user_id);
    if (!alreadySuspended) {
      await suspendUser({
        userId: report.reported_user_id,
        type:   'auto_pending',
        reason: `Auto-suspended: ${count} pending reports from different users`,
      });
    }
  }
}

// ─── Apply moderator action from queue review ─────────────────────────────────

export async function applyAction(params: {
  queueId:     string;
  moderatorId: string;
  action:      ActionTaken;
  note?:       string;
  banExpires?: Date;
}) {
  const supabase = getAdmin();

  // 1. Update queue item
  await supabase.from('moderation_queue')
    .update({
      status:         params.action === 'none' ? 'approved' : 'rejected',
      reviewed_by:    params.moderatorId,
      reviewed_at:    new Date().toISOString(),
      action_taken:   params.action,
      moderator_note: params.note ?? null,
    })
    .eq('id', params.queueId);

  // Fetch queue item to know user + content
  const { data: item } = await supabase
    .from('moderation_queue')
    .select('user_id, content_type, content_id')
    .eq('id', params.queueId)
    .single();

  if (!item) return;

  // 2. Apply user-level action
  switch (params.action) {
    case 'warning':
      await suspendUser({
        userId: item.user_id,
        type:   'warning',
        reason: params.note ?? 'Moderator warning',
      });
      break;

    case 'temp_ban':
      await suspendUser({
        userId:    item.user_id,
        type:      'temp_ban',
        reason:    params.note ?? 'Temporary ban',
        expiresAt: params.banExpires ?? new Date(Date.now() + 7 * 24 * 3600_000),
      });
      break;

    case 'perm_ban':
      await suspendUser({
        userId:  item.user_id,
        type:    'perm_ban',
        reason:  params.note ?? 'Permanent ban',
      });
      // Anonymise profile data
      await supabase.from('profiles')
        .update({ display_name: '[Removed]', bio: null, deleted_at: new Date().toISOString() })
        .eq('id', item.user_id);
      break;

    case 'content_removed':
      if (item.content_type === 'photo') {
        await supabase.from('profile_photos')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.content_id);
      } else if (item.content_type === 'message') {
        await supabase.from('messages')
          .update({ unsent_at: new Date().toISOString() })
          .eq('id', item.content_id);
      }
      break;
  }

  // 3. Lift auto-pending suspensions on approve/warn
  if (params.action === 'none' || params.action === 'warning') {
    const { data: suspensions } = await supabase
      .from('user_suspensions')
      .select('id')
      .eq('user_id', item.user_id)
      .eq('type', 'auto_pending')
      .is('lifted_at', null);

    if (suspensions?.length) {
      await Promise.all(
        suspensions.map(s => liftSuspension(s.id, params.moderatorId)),
      );
    }
  }
}
