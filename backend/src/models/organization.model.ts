import pool from '../config/database';

export interface OrganizationRow {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  logo_thumbnail_url: string | null;
  primary_color: string | null;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function createOrganization(
  name: string,
  subdomain: string,
): Promise<OrganizationRow> {
  const result = await pool.query(
    `INSERT INTO organizations (name, subdomain) VALUES ($1, $2) RETURNING *`,
    [name, subdomain],
  );
  return result.rows[0];
}

export async function findOrganizationById(id: string): Promise<OrganizationRow | null> {
  const result = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function findOrganizationBySubdomain(subdomain: string): Promise<OrganizationRow | null> {
  const result = await pool.query('SELECT * FROM organizations WHERE subdomain = $1', [subdomain]);
  return result.rows[0] || null;
}

export async function updateOrganization(
  id: string,
  updates: Partial<Pick<OrganizationRow, 'name' | 'logo_url' | 'logo_thumbnail_url' | 'primary_color'>>,
): Promise<OrganizationRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findOrganizationById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}
