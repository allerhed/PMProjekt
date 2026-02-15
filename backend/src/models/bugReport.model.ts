import pool from '../config/database';

export interface BugReportRow {
  id: string;
  organization_id: string;
  report_number: number;
  title: string;
  description: string | null;
  steps_to_reproduce: string | null;
  status: string;
  priority: string;
  screenshot_url: string | null;
  console_logs: Record<string, unknown>[] | null;
  metadata: Record<string, unknown> | null;
  reported_by: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  reporter_first_name?: string;
  reporter_last_name?: string;
  reporter_email?: string;
  assignee_first_name?: string;
  assignee_last_name?: string;
}

export async function findBugReportsByOrganization(
  organizationId: string,
  pagination: { limit: number; offset: number },
  filters?: { status?: string; priority?: string; search?: string },
): Promise<{ bugReports: BugReportRow[]; total: number }> {
  const conditions = ['br.organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (filters?.status) {
    conditions.push(`br.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }
  if (filters?.priority) {
    conditions.push(`br.priority = $${paramIndex}`);
    values.push(filters.priority);
    paramIndex++;
  }
  if (filters?.search) {
    conditions.push(`(br.title ILIKE $${paramIndex} OR br.description ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM bug_reports br WHERE ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT br.*,
            ru.first_name as reporter_first_name, ru.last_name as reporter_last_name, ru.email as reporter_email,
            au.first_name as assignee_first_name, au.last_name as assignee_last_name
     FROM bug_reports br
     LEFT JOIN users ru ON ru.id = br.reported_by
     LEFT JOIN users au ON au.id = br.assigned_to
     WHERE ${whereClause}
     ORDER BY br.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, pagination.limit, pagination.offset],
  );

  return { bugReports: result.rows, total };
}

export async function findBugReportById(
  id: string,
  organizationId: string,
): Promise<BugReportRow | null> {
  const result = await pool.query(
    `SELECT br.*,
            ru.first_name as reporter_first_name, ru.last_name as reporter_last_name, ru.email as reporter_email,
            au.first_name as assignee_first_name, au.last_name as assignee_last_name
     FROM bug_reports br
     LEFT JOIN users ru ON ru.id = br.reported_by
     LEFT JOIN users au ON au.id = br.assigned_to
     WHERE br.id = $1 AND br.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] || null;
}

export async function getNextReportNumber(organizationId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COALESCE(MAX(report_number), 0) + 1 as next_number FROM bug_reports WHERE organization_id = $1',
    [organizationId],
  );
  return result.rows[0].next_number;
}

export async function createBugReport(data: {
  organizationId: string;
  reportNumber: number;
  title: string;
  description?: string;
  stepsToReproduce?: string;
  priority?: string;
  screenshotUrl?: string;
  consoleLogs?: unknown[];
  metadata?: Record<string, unknown>;
  reportedBy: string;
}): Promise<BugReportRow> {
  const result = await pool.query(
    `INSERT INTO bug_reports (organization_id, report_number, title, description, steps_to_reproduce,
       priority, screenshot_url, console_logs, metadata, reported_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      data.organizationId,
      data.reportNumber,
      data.title,
      data.description || null,
      data.stepsToReproduce || null,
      data.priority || 'medium',
      data.screenshotUrl || null,
      data.consoleLogs ? JSON.stringify(data.consoleLogs) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.reportedBy,
    ],
  );
  return result.rows[0];
}

export async function updateBugReport(
  id: string,
  data: Record<string, unknown>,
): Promise<BugReportRow | null> {
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    stepsToReproduce: 'steps_to_reproduce',
    status: 'status',
    priority: 'priority',
    assignedTo: 'assigned_to',
    resolutionNotes: 'resolution_notes',
    resolvedAt: 'resolved_at',
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    const dbField = fieldMap[key];
    if (dbField && value !== undefined) {
      setClauses.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return findBugReportById(id, '');

  values.push(id);
  const result = await pool.query(
    `UPDATE bug_reports SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteBugReport(id: string): Promise<BugReportRow | null> {
  const result = await pool.query(
    'DELETE FROM bug_reports WHERE id = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
}

export async function countOpenBugReports(organizationId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM bug_reports WHERE organization_id = $1 AND status IN ('open', 'in_progress')`,
    [organizationId],
  );
  return parseInt(result.rows[0].count, 10);
}
