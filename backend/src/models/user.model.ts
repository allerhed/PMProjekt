import pool from '../config/database';
import { UserRole } from '../types';

export interface UserRow {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  custom_fields: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export async function createUser(data: {
  organizationId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  customFields?: Record<string, unknown>;
}): Promise<UserRow> {
  const result = await pool.query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, custom_fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.organizationId, data.email, data.passwordHash, data.firstName, data.lastName, data.role, JSON.stringify(data.customFields || {})],
  );
  return result.rows[0];
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function findUsersByOrganization(
  organizationId: string,
  options: { role?: UserRole; isActive?: boolean; page?: number; limit?: number } = {},
): Promise<{ users: UserRow[]; total: number }> {
  const { role, isActive, page = 1, limit = 50 } = options;
  const conditions = ['organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (role) {
    conditions.push(`role = $${paramIndex}`);
    values.push(role);
    paramIndex++;
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex}`);
    values.push(isActive);
    paramIndex++;
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM users WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values,
  );

  return { users: result.rows, total };
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<UserRow, 'first_name' | 'last_name' | 'role' | 'is_active' | 'password_hash' | 'custom_fields'>>,
): Promise<UserRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(key === 'custom_fields' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findUserById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function updateLastLogin(id: string): Promise<void> {
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function incrementFailedLogins(id: string): Promise<number> {
  const result = await pool.query(
    `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1 RETURNING failed_login_attempts`,
    [id],
  );
  return result.rows[0]?.failed_login_attempts || 0;
}

export async function lockAccount(id: string, minutes: number = 15): Promise<void> {
  await pool.query(
    `UPDATE users SET locked_until = NOW() + ($2 || ' minutes')::INTERVAL WHERE id = $1`,
    [id, minutes.toString()],
  );
}

export async function resetFailedLogins(id: string): Promise<void> {
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [id],
  );
}

export async function isAccountLocked(user: UserRow): Promise<boolean> {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}
