import pool from '../config/database';

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export async function createResetToken(
  userId: string,
  tokenHash: string,
  expiresInHours: number = 1,
): Promise<PasswordResetTokenRow> {
  const result = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(hours => $3)) RETURNING *`,
    [userId, tokenHash, expiresInHours],
  );
  return result.rows[0];
}

export async function findValidResetToken(tokenHash: string): Promise<PasswordResetTokenRow | null> {
  const result = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

export async function markTokenUsed(id: string): Promise<void> {
  await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [id]);
}
