import pool from '../config/database';

export interface CommentRow {
  id: string;
  task_id: string;
  user_id: string | null;
  external_email: string | null;
  comment_text: string;
  created_at: Date;
  user_first_name?: string;
  user_last_name?: string;
}

export async function findCommentsByTask(
  taskId: string,
  pagination: { limit: number; offset: number } = { limit: 50, offset: 0 },
): Promise<{ comments: CommentRow[]; total: number }> {
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM task_comments WHERE task_id = $1',
    [taskId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT tc.*, u.first_name as user_first_name, u.last_name as user_last_name
     FROM task_comments tc
     LEFT JOIN users u ON u.id = tc.user_id
     WHERE tc.task_id = $1
     ORDER BY tc.created_at ASC
     LIMIT $2 OFFSET $3`,
    [taskId, pagination.limit, pagination.offset],
  );

  return { comments: result.rows, total };
}

export async function createComment(data: {
  taskId: string;
  userId?: string;
  externalEmail?: string;
  commentText: string;
}): Promise<CommentRow> {
  const result = await pool.query(
    `INSERT INTO task_comments (task_id, user_id, external_email, comment_text)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.taskId, data.userId || null, data.externalEmail || null, data.commentText],
  );
  return result.rows[0];
}
