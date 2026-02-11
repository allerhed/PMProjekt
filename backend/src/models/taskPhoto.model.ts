import pool from '../config/database';

export interface TaskPhotoRow {
  id: string;
  task_id: string;
  file_url: string;
  file_size_bytes: number;
  thumbnail_url: string | null;
  caption: string | null;
  uploaded_by: string | null;
  uploaded_at: Date;
}

export async function findPhotosByTask(
  taskId: string,
  organizationId: string,
): Promise<TaskPhotoRow[]> {
  const result = await pool.query(
    `SELECT tp.*
     FROM task_photos tp
     JOIN tasks t ON t.id = tp.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE tp.task_id = $1 AND p.organization_id = $2
     ORDER BY tp.uploaded_at DESC`,
    [taskId, organizationId],
  );
  return result.rows;
}

export async function findPhotoById(
  id: string,
  organizationId?: string,
): Promise<TaskPhotoRow | null> {
  const conditions = ['tp.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT tp.*
     FROM task_photos tp
     JOIN tasks t ON t.id = tp.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createTaskPhoto(data: {
  taskId: string;
  fileUrl: string;
  fileSizeBytes: number;
  thumbnailUrl?: string;
  caption?: string;
  uploadedBy: string;
}): Promise<TaskPhotoRow> {
  const result = await pool.query(
    `INSERT INTO task_photos (task_id, file_url, file_size_bytes, thumbnail_url, caption, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      data.taskId, data.fileUrl, data.fileSizeBytes,
      data.thumbnailUrl || null, data.caption || null,
      data.uploadedBy,
    ],
  );
  return result.rows[0];
}

export async function updatePhotoAfterConfirm(
  id: string,
  data: {
    fileUrl: string;
    fileSizeBytes: number;
    thumbnailUrl?: string;
  },
): Promise<TaskPhotoRow | null> {
  const result = await pool.query(
    `UPDATE task_photos SET file_url = $1, file_size_bytes = $2, thumbnail_url = $3
     WHERE id = $4 RETURNING *`,
    [data.fileUrl, data.fileSizeBytes, data.thumbnailUrl || null, id],
  );
  return result.rows[0] || null;
}

export async function deleteTaskPhoto(id: string): Promise<TaskPhotoRow | null> {
  const result = await pool.query(
    'DELETE FROM task_photos WHERE id = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
}
