import pool from '../config/database';

export interface BackupRow {
  id: string;
  organization_id: string;
  name: string;
  status: 'in_progress' | 'completed' | 'failed';
  file_key: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  triggered_by: 'manual' | 'scheduled';
  initiated_by: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BackupSettingsRow {
  id: string;
  organization_id: string;
  schedule_enabled: boolean;
  schedule_cron: string;
  retention_days: number;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findBackupsByOrganization(
  organizationId: string,
  limit: number = 50,
): Promise<BackupRow[]> {
  const result = await pool.query(
    `SELECT b.*, u.first_name AS initiated_by_first_name, u.last_name AS initiated_by_last_name
     FROM backups b
     LEFT JOIN users u ON u.id = b.initiated_by
     WHERE b.organization_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [organizationId, limit],
  );
  return result.rows;
}

export async function findBackupById(
  id: string,
  organizationId: string,
): Promise<BackupRow | null> {
  const result = await pool.query(
    'SELECT * FROM backups WHERE id = $1 AND organization_id = $2',
    [id, organizationId],
  );
  return result.rows[0] || null;
}

export async function createBackup(data: {
  organizationId: string;
  name: string;
  triggeredBy: 'manual' | 'scheduled';
  initiatedBy?: string;
}): Promise<BackupRow> {
  const result = await pool.query(
    `INSERT INTO backups (organization_id, name, triggered_by, initiated_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.organizationId, data.name, data.triggeredBy, data.initiatedBy || null],
  );
  return result.rows[0];
}

export async function updateBackupCompleted(
  id: string,
  fileKey: string,
  fileSizeBytes: number,
): Promise<BackupRow | null> {
  const result = await pool.query(
    `UPDATE backups SET status = 'completed', file_key = $1, file_size_bytes = $2, completed_at = NOW()
     WHERE id = $3 RETURNING *`,
    [fileKey, fileSizeBytes, id],
  );
  return result.rows[0] || null;
}

export async function updateBackupFailed(
  id: string,
  errorMessage: string,
): Promise<BackupRow | null> {
  const result = await pool.query(
    `UPDATE backups SET status = 'failed', error_message = $1
     WHERE id = $2 RETURNING *`,
    [errorMessage, id],
  );
  return result.rows[0] || null;
}

export async function deleteBackup(id: string): Promise<void> {
  await pool.query('DELETE FROM backups WHERE id = $1', [id]);
}

export async function findExpiredBackups(
  organizationId: string,
  retentionDays: number,
): Promise<BackupRow[]> {
  const result = await pool.query(
    `SELECT * FROM backups
     WHERE organization_id = $1
       AND status = 'completed'
       AND created_at < NOW() - INTERVAL '1 day' * $2`,
    [organizationId, retentionDays],
  );
  return result.rows;
}

export async function hasInProgressBackup(organizationId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM backups WHERE organization_id = $1 AND status = 'in_progress') AS exists`,
    [organizationId],
  );
  return result.rows[0].exists;
}

export async function getBackupSettings(
  organizationId: string,
): Promise<BackupSettingsRow | null> {
  const result = await pool.query(
    'SELECT * FROM backup_settings WHERE organization_id = $1',
    [organizationId],
  );
  return result.rows[0] || null;
}

export async function upsertBackupSettings(data: {
  organizationId: string;
  scheduleEnabled: boolean;
  scheduleCron: string;
  retentionDays: number;
  updatedBy: string;
}): Promise<BackupSettingsRow> {
  const result = await pool.query(
    `INSERT INTO backup_settings (organization_id, schedule_enabled, schedule_cron, retention_days, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id) DO UPDATE SET
       schedule_enabled = EXCLUDED.schedule_enabled,
       schedule_cron = EXCLUDED.schedule_cron,
       retention_days = EXCLUDED.retention_days,
       updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [data.organizationId, data.scheduleEnabled, data.scheduleCron, data.retentionDays, data.updatedBy],
  );
  return result.rows[0];
}

export async function findAllEnabledSchedules(): Promise<BackupSettingsRow[]> {
  const result = await pool.query(
    'SELECT * FROM backup_settings WHERE schedule_enabled = true',
  );
  return result.rows;
}
