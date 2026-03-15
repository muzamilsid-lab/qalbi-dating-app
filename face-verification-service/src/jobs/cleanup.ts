import { query } from '../db/client';
import { auditService } from '../services/AuditService';

/**
 * Runs two cleanup tasks:
 *  1. Expire sessions whose TTL has passed
 *  2. GDPR: Delete face reference images past their 24h retention window
 *
 * Called on a schedule from server.ts (every 5 minutes).
 */
export async function runCleanupJobs(): Promise<void> {
  await Promise.allSettled([expireSessions(), deleteExpiredImages()]);
}

async function expireSessions(): Promise<void> {
  try {
    const rows = await query<{ expire_old_sessions: number }>(
      `SELECT expire_old_sessions()`
    );
    const count = rows[0]?.expire_old_sessions ?? 0;
    if (count > 0) {
      console.info(`[Cleanup] Expired ${count} stale session(s)`);
    }
  } catch (err) {
    console.error('[Cleanup] Session expiry failed:', err);
  }
}

async function deleteExpiredImages(): Promise<void> {
  try {
    // Fetch IDs before deletion so we can audit them
    const expired = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM face_references WHERE delete_at < NOW()`
    );

    if (expired.length === 0) return;

    const rows = await query<{ delete_expired_images: number }>(
      `SELECT delete_expired_images()`
    );
    const count = rows[0]?.delete_expired_images ?? 0;

    console.info(`[Cleanup] GDPR: Deleted ${count} expired image reference(s)`);

    // Audit each deletion
    await Promise.all(
      expired.map(ref =>
        auditService.log({
          userId:    ref.user_id,
          action:    'image.delete',
          result:    'success',
          detail:    { referenceId: ref.id, reason: 'gdpr_retention_expired' },
          ipAddress: 'system',
        })
      )
    );
  } catch (err) {
    console.error('[Cleanup] Image deletion failed:', err);
  }
}
