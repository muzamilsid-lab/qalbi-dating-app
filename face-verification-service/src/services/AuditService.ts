import { query } from '../db/client';
import { AuditAction, AuditLog } from '../types';

interface LogParams {
  sessionId?: string | null;
  userId?: string | null;
  action: AuditAction;
  result: AuditLog['result'];
  detail?: Record<string, unknown>;
  ipAddress: string;
}

export class AuditService {
  async log(params: LogParams): Promise<void> {
    const { sessionId, userId, action, result, detail = {}, ipAddress } = params;

    try {
      await query(
        `INSERT INTO audit_logs (session_id, user_id, action, result, detail, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId ?? null, userId ?? null, action, result, JSON.stringify(detail), ipAddress]
      );
    } catch (err) {
      // Audit failures must never crash the main flow — just log to stderr
      console.error('[Audit] Failed to write audit log:', err);
    }
  }

  async getSessionLogs(sessionId: string): Promise<AuditLog[]> {
    return query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE  session_id = $1
       ORDER  BY created_at ASC`,
      [sessionId]
    );
  }

  async getUserLogs(userId: string, limit = 50): Promise<AuditLog[]> {
    return query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT  $2`,
      [userId, limit]
    );
  }
}

export const auditService = new AuditService();
