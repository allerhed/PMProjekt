import pool from '../config/database';

export interface TaskRow {
  id: string;
  project_id: string;
  task_number: number;
  blueprint_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  trade: string | null;
  location_x: number | null;
  location_y: number | null;
  assigned_to_user: string | null;
  assigned_to_contractor_email: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  verified_at: Date | null;
  annotation_x: number | null;
  annotation_y: number | null;
  annotation_width: number | null;
  annotation_height: number | null;
  annotation_page: number | null;
}

export interface TaskWithCounts extends TaskRow {
  photo_count: number;
  comment_count: number;
  product_count: number;
  project_name?: string;
  creator_first_name?: string;
  creator_last_name?: string;
  assignee_first_name?: string;
  assignee_last_name?: string;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  trade?: string;
  assignedToUser?: string;
  assignedToContractorEmail?: string;
  search?: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress'],
  in_progress: ['completed', 'open'],
  completed: ['verified', 'in_progress'],
  verified: [],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function findTasksByProject(
  projectId: string,
  organizationId: string,
  filters: TaskFilters = {},
  pagination: { limit: number; offset: number } = { limit: 50, offset: 0 },
): Promise<{ tasks: TaskWithCounts[]; total: number }> {
  const conditions = ['t.project_id = $1', 'p.organization_id = $2'];
  const values: unknown[] = [projectId, organizationId];
  let paramIndex = 3;

  if (filters.status) {
    conditions.push(`t.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${paramIndex}`);
    values.push(filters.priority);
    paramIndex++;
  }
  if (filters.trade) {
    conditions.push(`t.trade = $${paramIndex}`);
    values.push(filters.trade);
    paramIndex++;
  }
  if (filters.assignedToUser) {
    conditions.push(`t.assigned_to_user = $${paramIndex}`);
    values.push(filters.assignedToUser);
    paramIndex++;
  }
  if (filters.assignedToContractorEmail) {
    conditions.push(`t.assigned_to_contractor_email = $${paramIndex}`);
    values.push(filters.assignedToContractorEmail);
    paramIndex++;
  }
  if (filters.search) {
    conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(pagination.limit, pagination.offset);
  const result = await pool.query(
    `SELECT t.*,
       p.name as project_name,
       COALESCE(ph.cnt, 0)::int as photo_count,
       COALESCE(cm.cnt, 0)::int as comment_count,
       COALESCE(tp.cnt, 0)::int as product_count,
       cu.first_name as creator_first_name,
       cu.last_name as creator_last_name,
       au.first_name as assignee_first_name,
       au.last_name as assignee_last_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_photos WHERE task_id = t.id) ph ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_comments WHERE task_id = t.id) cm ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_products WHERE task_id = t.id) tp ON true
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN users au ON au.id = t.assigned_to_user
     WHERE ${where}
     ORDER BY
       CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
       t.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values,
  );

  return { tasks: result.rows, total };
}

export async function findTaskById(
  id: string,
  organizationId?: string,
): Promise<TaskWithCounts | null> {
  const conditions = ['t.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT t.*,
       p.name as project_name,
       COALESCE(ph.cnt, 0)::int as photo_count,
       COALESCE(cm.cnt, 0)::int as comment_count,
       COALESCE(tp.cnt, 0)::int as product_count,
       cu.first_name as creator_first_name,
       cu.last_name as creator_last_name,
       au.first_name as assignee_first_name,
       au.last_name as assignee_last_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_photos WHERE task_id = t.id) ph ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_comments WHERE task_id = t.id) cm ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_products WHERE task_id = t.id) tp ON true
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN users au ON au.id = t.assigned_to_user
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createTask(data: {
  projectId: string;
  blueprintId?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  trade?: string;
  locationX?: number;
  locationY?: number;
  assignedToUser?: string;
  assignedToContractorEmail?: string;
  createdBy: string;
  annotationX?: number;
  annotationY?: number;
  annotationWidth?: number;
  annotationHeight?: number;
  annotationPage?: number;
}): Promise<TaskRow> {
  const result = await pool.query(
    `INSERT INTO tasks (project_id, task_number, blueprint_id, title, description, status, priority, trade,
       location_x, location_y, assigned_to_user, assigned_to_contractor_email, created_by,
       annotation_x, annotation_y, annotation_width, annotation_height, annotation_page)
     VALUES ($1, (SELECT COALESCE(MAX(task_number), 0) + 1 FROM tasks WHERE project_id = $1), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
    [
      data.projectId, data.blueprintId || null, data.title, data.description || null,
      data.status || 'open', data.priority || 'normal', data.trade || null,
      data.locationX ?? null, data.locationY ?? null,
      data.assignedToUser || null, data.assignedToContractorEmail || null,
      data.createdBy,
      data.annotationX ?? null, data.annotationY ?? null,
      data.annotationWidth ?? null, data.annotationHeight ?? null,
      data.annotationPage ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateTask(
  id: string,
  updates: Record<string, unknown>,
): Promise<TaskRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Map camelCase to snake_case for known fields
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    status: 'status',
    priority: 'priority',
    trade: 'trade',
    blueprintId: 'blueprint_id',
    locationX: 'location_x',
    locationY: 'location_y',
    assignedToUser: 'assigned_to_user',
    assignedToContractorEmail: 'assigned_to_contractor_email',
    completedAt: 'completed_at',
    verifiedAt: 'verified_at',
    annotationX: 'annotation_x',
    annotationY: 'annotation_y',
    annotationWidth: 'annotation_width',
    annotationHeight: 'annotation_height',
    annotationPage: 'annotation_page',
  };

  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key] || key;
    if (value !== undefined) {
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  values.push(id);
  const result = await pool.query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function findTasksByBlueprint(
  blueprintId: string,
  organizationId: string,
): Promise<TaskWithCounts[]> {
  const result = await pool.query(
    `SELECT t.*,
       p.name as project_name,
       COALESCE(ph.cnt, 0)::int as photo_count,
       COALESCE(cm.cnt, 0)::int as comment_count,
       COALESCE(tp.cnt, 0)::int as product_count,
       cu.first_name as creator_first_name,
       cu.last_name as creator_last_name,
       au.first_name as assignee_first_name,
       au.last_name as assignee_last_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_photos WHERE task_id = t.id) ph ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_comments WHERE task_id = t.id) cm ON true
     LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM task_products WHERE task_id = t.id) tp ON true
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN users au ON au.id = t.assigned_to_user
     WHERE t.blueprint_id = $1 AND p.organization_id = $2
     ORDER BY t.task_number`,
    [blueprintId, organizationId],
  );
  return result.rows;
}
