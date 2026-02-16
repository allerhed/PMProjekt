import pool from '../config/database';

export interface OrgStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  verifiedTasks: number;
  taskCompletionRate: number;
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<string, number>;
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsedPercent: number;
  weeklyLogins: number;
  weeklyTasksCreated: number;
  weeklyTasksCompleted: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

export interface UserActivity {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  loginCount: number;
  tasksCreated: number;
  tasksCompleted: number;
  lastLoginAt: Date | null;
}

export async function getOrgStats(organizationId: string): Promise<OrgStats> {
  const [projectResult, taskResult, userResult, orgResult, usersByRoleResult, weeklyResult] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
       FROM projects
       WHERE organization_id = $1`,
      [organizationId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE t.status = 'open')::int AS open,
         COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE t.status = 'verified')::int AS verified
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE p.organization_id = $1`,
      [organizationId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active
       FROM users
       WHERE organization_id = $1`,
      [organizationId],
    ),
    pool.query(
      `SELECT storage_used_bytes, storage_limit_bytes
       FROM organizations
       WHERE id = $1`,
      [organizationId],
    ),
    pool.query(
      `SELECT role, COUNT(*)::int AS count
       FROM users
       WHERE organization_id = $1 AND is_active = true
       GROUP BY role`,
      [organizationId],
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE action = 'user.login')::int AS logins,
         COUNT(*) FILTER (WHERE action = 'task.created')::int AS tasks_created,
         COUNT(*) FILTER (WHERE action = 'task.status_changed' AND metadata->>'to' = 'completed')::int AS tasks_completed
       FROM audit_log
       WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [organizationId],
    ),
  ]);

  const projects = projectResult.rows[0];
  const tasks = taskResult.rows[0];
  const users = userResult.rows[0];
  const org = orgResult.rows[0] || { storage_used_bytes: 0, storage_limit_bytes: 0 };
  const weekly = weeklyResult.rows[0];

  const usersByRole: Record<string, number> = {};
  for (const row of usersByRoleResult.rows) {
    usersByRole[row.role] = row.count;
  }

  const storageUsedBytes = Number(org.storage_used_bytes) || 0;
  const storageLimitBytes = Number(org.storage_limit_bytes) || 0;
  const storageUsedPercent = storageLimitBytes > 0
    ? Math.round((storageUsedBytes / storageLimitBytes) * 10000) / 100
    : 0;

  const totalFinished = tasks.completed + tasks.verified;
  const taskCompletionRate = tasks.total > 0
    ? Math.round((totalFinished / tasks.total) * 10000) / 100
    : 0;

  return {
    totalProjects: projects.total,
    activeProjects: projects.active,
    completedProjects: projects.completed,
    totalTasks: tasks.total,
    openTasks: tasks.open,
    inProgressTasks: tasks.in_progress,
    completedTasks: tasks.completed,
    verifiedTasks: tasks.verified,
    taskCompletionRate,
    totalUsers: users.total,
    activeUsers: users.active,
    usersByRole,
    storageUsedBytes,
    storageLimitBytes,
    storageUsedPercent,
    weeklyLogins: weekly.logins,
    weeklyTasksCreated: weekly.tasks_created,
    weeklyTasksCompleted: weekly.tasks_completed,
  };
}

export async function getRecentActivity(
  organizationId: string,
  limit: number = 50,
): Promise<ActivityEntry[]> {
  const result = await pool.query(
    `SELECT a.id, a.action, a.resource_type, a.resource_id, a.metadata, a.created_at,
            u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.organization_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [organizationId, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    metadata: row.metadata,
    created_at: row.created_at,
    user_email: row.user_email,
    user_first_name: row.user_first_name,
    user_last_name: row.user_last_name,
  }));
}

export async function getUserActivity(
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<UserActivity[]> {
  const dateFilter = startDate && endDate
    ? `AND a.created_at BETWEEN $2 AND $3`
    : startDate
      ? `AND a.created_at >= $2`
      : '';
  const params: unknown[] = [organizationId];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const result = await pool.query(
    `SELECT
       u.id AS user_id,
       u.email,
       u.first_name,
       u.last_name,
       u.role,
       u.last_login_at,
       COUNT(*) FILTER (WHERE a.action = 'user.login')::int AS login_count,
       COUNT(*) FILTER (WHERE a.action = 'task.created')::int AS tasks_created,
       COUNT(*) FILTER (WHERE a.action = 'task.status_changed' AND a.metadata->>'to' = 'completed')::int AS tasks_completed
     FROM users u
     LEFT JOIN audit_log a ON a.user_id = u.id ${dateFilter}
     WHERE u.organization_id = $1 AND u.is_active = true
     GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.last_login_at
     ORDER BY login_count DESC`,
    params,
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    loginCount: row.login_count,
    tasksCreated: row.tasks_created,
    tasksCompleted: row.tasks_completed,
    lastLoginAt: row.last_login_at,
  }));
}
