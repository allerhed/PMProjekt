import pool from '../config/database';

export interface ProtocolRow {
  id: string;
  project_id: string;
  name: string;
  filters: Record<string, unknown> | null;
  file_url: string | null;
  file_size_bytes: number | null;
  status: string;
  generated_by: string | null;
  generated_at: Date;
}

export async function findProtocolsByProject(
  projectId: string,
  organizationId: string,
): Promise<ProtocolRow[]> {
  const result = await pool.query(
    `SELECT pr.*
     FROM protocols pr
     JOIN projects p ON p.id = pr.project_id
     WHERE pr.project_id = $1 AND p.organization_id = $2
     ORDER BY pr.generated_at DESC`,
    [projectId, organizationId],
  );
  return result.rows;
}

export async function findProtocolById(
  id: string,
  organizationId?: string,
): Promise<ProtocolRow | null> {
  const conditions = ['pr.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT pr.*
     FROM protocols pr
     JOIN projects p ON p.id = pr.project_id
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createProtocol(data: {
  projectId: string;
  name: string;
  filters: Record<string, unknown>;
  generatedBy: string;
}): Promise<ProtocolRow> {
  const result = await pool.query(
    `INSERT INTO protocols (project_id, name, filters, status, generated_by)
     VALUES ($1, $2, $3, 'generating', $4) RETURNING *`,
    [data.projectId, data.name, JSON.stringify(data.filters), data.generatedBy],
  );
  return result.rows[0];
}

export async function updateProtocolCompleted(
  id: string,
  fileUrl: string,
  fileSizeBytes: number,
): Promise<ProtocolRow | null> {
  const result = await pool.query(
    `UPDATE protocols SET status = 'completed', file_url = $1, file_size_bytes = $2
     WHERE id = $3 RETURNING *`,
    [fileUrl, fileSizeBytes, id],
  );
  return result.rows[0] || null;
}

export async function updateProtocolFailed(id: string): Promise<ProtocolRow | null> {
  const result = await pool.query(
    `UPDATE protocols SET status = 'failed' WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
}
