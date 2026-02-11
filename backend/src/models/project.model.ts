import pool from '../config/database';

export interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  address: string | null;
  status: string;
  start_date: string | null;
  target_completion_date: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithStats extends ProjectRow {
  total_tasks: number;
  open_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  verified_tasks: number;
}

export async function findProjectsByOrganization(
  organizationId: string,
  options: { status?: string; page?: number; limit?: number; offset?: number } = {},
): Promise<{ projects: ProjectWithStats[]; total: number }> {
  const { status, page = 1, limit = 50, offset = (page - 1) * limit } = options;
  const conditions = ['p.organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`p.status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM projects p WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);
  const result = await pool.query(
    `SELECT p.*,
       COALESCE(ts.total, 0)::int as total_tasks,
       COALESCE(ts.open, 0)::int as open_tasks,
       COALESCE(ts.in_progress, 0)::int as in_progress_tasks,
       COALESCE(ts.completed, 0)::int as completed_tasks,
       COALESCE(ts.verified, 0)::int as verified_tasks
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'open') as open,
         COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'verified') as verified
       FROM tasks WHERE project_id = p.id
     ) ts ON true
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values,
  );

  return { projects: result.rows, total };
}

export async function findProjectById(
  id: string,
  organizationId?: string,
): Promise<ProjectWithStats | null> {
  const conditions = ['p.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT p.*,
       COALESCE(ts.total, 0)::int as total_tasks,
       COALESCE(ts.open, 0)::int as open_tasks,
       COALESCE(ts.in_progress, 0)::int as in_progress_tasks,
       COALESCE(ts.completed, 0)::int as completed_tasks,
       COALESCE(ts.verified, 0)::int as verified_tasks
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'open') as open,
         COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'verified') as verified
       FROM tasks WHERE project_id = p.id
     ) ts ON true
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createProject(data: {
  organizationId: string;
  name: string;
  description?: string;
  address?: string;
  status?: string;
  startDate?: string;
  targetCompletionDate?: string;
  createdBy: string;
}): Promise<ProjectRow> {
  const result = await pool.query(
    `INSERT INTO projects (organization_id, name, description, address, status, start_date, target_completion_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.organizationId, data.name, data.description || null,
      data.address || null, data.status || 'active',
      data.startDate || null, data.targetCompletionDate || null, data.createdBy,
    ],
  );
  return result.rows[0];
}

export async function updateProject(
  id: string,
  organizationId: string,
  updates: Partial<Pick<ProjectRow, 'name' | 'description' | 'address' | 'status' | 'start_date' | 'target_completion_date'>>,
): Promise<ProjectRow | null> {
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

  if (fields.length === 0) return findProjectById(id, organizationId);

  values.push(id, organizationId);
  const result = await pool.query(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteProject(id: string, organizationId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE projects SET status = 'archived' WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [id, organizationId],
  );
  return (result.rowCount ?? 0) > 0;
}
