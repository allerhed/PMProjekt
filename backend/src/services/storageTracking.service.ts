import pool from '../config/database';
import { logger } from '../utils/logger';

/**
 * Check if an organization has enough storage remaining for an upload.
 */
export async function checkStorageLimit(
  organizationId: string,
  fileSize: number,
): Promise<{ allowed: boolean; usedBytes: number; limitBytes: number }> {
  const result = await pool.query(
    'SELECT storage_used_bytes, storage_limit_bytes FROM organizations WHERE id = $1',
    [organizationId],
  );

  if (result.rows.length === 0) {
    return { allowed: false, usedBytes: 0, limitBytes: 0 };
  }

  const { storage_used_bytes, storage_limit_bytes } = result.rows[0];
  const usedBytes = parseInt(storage_used_bytes, 10) || 0;
  const limitBytes = parseInt(storage_limit_bytes, 10) || 0;

  return {
    allowed: usedBytes + fileSize <= limitBytes,
    usedBytes,
    limitBytes,
  };
}

/**
 * Atomically increment storage usage for an organization.
 */
export async function incrementStorageUsed(
  organizationId: string,
  bytes: number,
): Promise<void> {
  await pool.query(
    'UPDATE organizations SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2',
    [bytes, organizationId],
  );
  logger.debug({ organizationId, bytes }, 'Storage usage incremented');
}

/**
 * Atomically decrement storage usage for an organization.
 */
export async function decrementStorageUsed(
  organizationId: string,
  bytes: number,
): Promise<void> {
  await pool.query(
    'UPDATE organizations SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id = $2',
    [bytes, organizationId],
  );
  logger.debug({ organizationId, bytes }, 'Storage usage decremented');
}

/**
 * Recalculate storage usage from actual file sizes in the database.
 * Returns old and new values for comparison.
 */
export async function recalculateStorageUsed(
  organizationId: string,
): Promise<{ previousBytes: number; calculatedBytes: number }> {
  // Get current counter value
  const orgResult = await pool.query(
    'SELECT storage_used_bytes FROM organizations WHERE id = $1',
    [organizationId],
  );
  const previousBytes = parseInt(orgResult.rows[0]?.storage_used_bytes, 10) || 0;

  // Calculate actual usage from all tracked file sizes
  const result = await pool.query(
    `SELECT
       COALESCE((
         SELECT SUM(b.file_size_bytes)
         FROM blueprints b
         JOIN projects p ON p.id = b.project_id
         WHERE p.organization_id = $1
       ), 0) +
       COALESCE((
         SELECT SUM(tp.file_size_bytes)
         FROM task_photos tp
         JOIN tasks t ON t.id = tp.task_id
         JOIN projects p ON p.id = t.project_id
         WHERE p.organization_id = $1
       ), 0) +
       COALESCE((
         SELECT SUM(pr.file_size_bytes)
         FROM protocols pr
         JOIN projects p ON p.id = pr.project_id
         WHERE p.organization_id = $1 AND pr.file_size_bytes IS NOT NULL
       ), 0) +
       COALESCE((
         SELECT SUM(bk.file_size_bytes)
         FROM backups bk
         WHERE bk.organization_id = $1 AND bk.file_size_bytes IS NOT NULL
       ), 0) AS total_bytes`,
    [organizationId],
  );

  const calculatedBytes = parseInt(result.rows[0].total_bytes, 10) || 0;

  // Update the counter
  await pool.query(
    'UPDATE organizations SET storage_used_bytes = $1 WHERE id = $2',
    [calculatedBytes, organizationId],
  );

  logger.info(
    { organizationId, previousBytes, calculatedBytes, drift: previousBytes - calculatedBytes },
    'Storage usage recalculated from database',
  );

  return { previousBytes, calculatedBytes };
}
