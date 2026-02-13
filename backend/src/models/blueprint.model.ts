import pool from '../config/database';

export interface BlueprintRow {
  id: string;
  project_id: string;
  name: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  thumbnail_url: string | null;
  width_pixels: number | null;
  height_pixels: number | null;
  uploaded_by: string | null;
  uploaded_at: Date;
}

export async function findBlueprintsByProject(
  projectId: string,
  organizationId: string,
): Promise<BlueprintRow[]> {
  const result = await pool.query(
    `SELECT b.*
     FROM blueprints b
     JOIN projects p ON p.id = b.project_id
     WHERE b.project_id = $1 AND p.organization_id = $2
     ORDER BY b.uploaded_at DESC`,
    [projectId, organizationId],
  );
  return result.rows;
}

export async function findBlueprintById(
  id: string,
  organizationId?: string,
): Promise<BlueprintRow | null> {
  const conditions = ['b.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT b.*
     FROM blueprints b
     JOIN projects p ON p.id = b.project_id
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createBlueprint(data: {
  projectId: string;
  name: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  thumbnailUrl?: string;
  widthPixels?: number;
  heightPixels?: number;
  uploadedBy: string;
}): Promise<BlueprintRow> {
  const result = await pool.query(
    `INSERT INTO blueprints (project_id, name, file_url, file_size_bytes, mime_type, thumbnail_url, width_pixels, height_pixels, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      data.projectId, data.name, data.fileUrl, data.fileSizeBytes,
      data.mimeType, data.thumbnailUrl || null,
      data.widthPixels ?? null, data.heightPixels ?? null,
      data.uploadedBy,
    ],
  );
  return result.rows[0];
}

export async function updateBlueprintAfterConfirm(
  id: string,
  data: {
    fileUrl: string;
    fileSizeBytes: number;
    thumbnailUrl?: string;
  },
): Promise<BlueprintRow | null> {
  const result = await pool.query(
    `UPDATE blueprints SET file_url = $1, file_size_bytes = $2, thumbnail_url = $3
     WHERE id = $4 RETURNING *`,
    [data.fileUrl, data.fileSizeBytes, data.thumbnailUrl || null, id],
  );
  return result.rows[0] || null;
}

export async function deleteBlueprint(id: string): Promise<BlueprintRow | null> {
  const result = await pool.query(
    'DELETE FROM blueprints WHERE id = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
}

export async function countTasksWithAnnotations(blueprintId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM tasks WHERE blueprint_id = $1 AND annotation_x IS NOT NULL',
    [blueprintId],
  );
  return parseInt(result.rows[0].count, 10);
}
