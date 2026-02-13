import pool from '../config/database';

export interface ReportTaskRow {
  id: string;
  task_number: number;
  title: string;
  status: string;
  priority: string;
  trade: string | null;
  created_at: Date;
  project_id: string;
  project_name: string;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
}

export interface TaskReportFilters {
  startDate: string;
  endDate: string;
  projectId?: string;
  userId?: string;
}

export async function findTasksForReport(
  organizationId: string,
  filters: TaskReportFilters,
): Promise<ReportTaskRow[]> {
  const conditions: string[] = ['p.organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  conditions.push(`t.created_at >= $${paramIndex}`);
  values.push(filters.startDate);
  paramIndex++;

  conditions.push(`t.created_at < ($${paramIndex}::date + interval '1 day')`);
  values.push(filters.endDate);
  paramIndex++;

  if (filters.projectId) {
    conditions.push(`t.project_id = $${paramIndex}`);
    values.push(filters.projectId);
    paramIndex++;
  }

  if (filters.userId) {
    conditions.push(`t.assigned_to_user = $${paramIndex}`);
    values.push(filters.userId);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT
       t.id,
       t.task_number,
       t.title,
       t.status,
       t.priority,
       t.trade,
       t.created_at,
       t.project_id,
       p.name AS project_name,
       au.first_name AS assignee_first_name,
       au.last_name AS assignee_last_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users au ON au.id = t.assigned_to_user
     WHERE ${where}
     ORDER BY t.created_at DESC`,
    values,
  );

  return result.rows;
}
