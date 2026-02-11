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
