import pool from '../config/database';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  organizationId: string;
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function logAuditAction(entry: AuditLogEntry): void {
  // Fire-and-forget via setImmediate — never fail the request
  setImmediate(async () => {
    try {
      await pool.query(
        `INSERT INTO audit_log (organization_id, user_id, action, resource_type, resource_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.organizationId,
          entry.userId,
          entry.action,
          entry.resourceType || null,
          entry.resourceId || null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.ipAddress || null,
        ],
      );
    } catch (err) {
      logger.error({ err, entry }, 'Failed to write audit log entry');
    }
  });
}
