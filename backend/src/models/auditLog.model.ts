import pool from '../config/database';

export interface AuditLogRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export async function findAuditLogsByOrganization(
  organizationId: string,
  options: { page?: number; limit?: number; offset?: number; action?: string } = {},
): Promise<{ logs: AuditLogRow[]; total: number }> {
  const { action, limit = 50, offset = 0 } = options;
  const conditions = ['organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (action) {
    conditions.push(`action = $${paramIndex}`);
    values.push(action);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM audit_log WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values,
  );

  return { logs: result.rows, total };
}
