import pool from '../config/database';

export interface ProjectNoteRow {
  id: string;
  project_id: string;
  content: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectNoteWithAuthor extends ProjectNoteRow {
  author_first_name: string;
  author_last_name: string;
}

export async function findNotesByProject(
  projectId: string,
  organizationId: string,
  sortBy: string = 'created_at',
  sortOrder: string = 'desc',
): Promise<ProjectNoteWithAuthor[]> {
  const allowedSorts: Record<string, string> = {
    created: 'n.created_at',
    edited: 'n.updated_at',
    author: 'u.first_name',
  };
  const orderCol = allowedSorts[sortBy] || 'n.created_at';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const result = await pool.query(
    `SELECT n.*, u.first_name AS author_first_name, u.last_name AS author_last_name
     FROM project_notes n
     JOIN users u ON u.id = n.created_by
     JOIN projects p ON p.id = n.project_id
     WHERE n.project_id = $1 AND p.organization_id = $2
     ORDER BY ${orderCol} ${dir}`,
    [projectId, organizationId],
  );
  return result.rows;
}

export async function findNoteById(
  id: string,
  organizationId: string,
): Promise<ProjectNoteWithAuthor | null> {
  const result = await pool.query(
    `SELECT n.*, u.first_name AS author_first_name, u.last_name AS author_last_name
     FROM project_notes n
     JOIN users u ON u.id = n.created_by
     JOIN projects p ON p.id = n.project_id
     WHERE n.id = $1 AND p.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] || null;
}

export async function createNote(data: {
  projectId: string;
  content: string;
  createdBy: string;
}): Promise<ProjectNoteWithAuthor> {
  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO project_notes (project_id, content, created_by)
       VALUES ($1, $2, $3) RETURNING *
     )
     SELECT i.*, u.first_name AS author_first_name, u.last_name AS author_last_name
     FROM inserted i
     JOIN users u ON u.id = i.created_by`,
    [data.projectId, data.content, data.createdBy],
  );
  return result.rows[0];
}

export async function updateNote(
  id: string,
  content: string,
): Promise<ProjectNoteWithAuthor | null> {
  const result = await pool.query(
    `WITH updated AS (
       UPDATE project_notes SET content = $1 WHERE id = $2 RETURNING *
     )
     SELECT u2.*, usr.first_name AS author_first_name, usr.last_name AS author_last_name
     FROM updated u2
     JOIN users usr ON usr.id = u2.created_by`,
    [content, id],
  );
  return result.rows[0] || null;
}

export async function deleteNote(id: string): Promise<ProjectNoteRow | null> {
  const result = await pool.query(
    'DELETE FROM project_notes WHERE id = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
}
