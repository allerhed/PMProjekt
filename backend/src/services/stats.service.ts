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
  totalUsers: number;
  activeUsers: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsedPercent: number;
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

export async function getOrgStats(organizationId: string): Promise<OrgStats> {
  const [projectResult, taskResult, userResult, orgResult] = await Promise.all([
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
  ]);

  const projects = projectResult.rows[0];
  const tasks = taskResult.rows[0];
  const users = userResult.rows[0];
  const org = orgResult.rows[0] || { storage_used_bytes: 0, storage_limit_bytes: 0 };

  const storageUsedBytes = Number(org.storage_used_bytes) || 0;
  const storageLimitBytes = Number(org.storage_limit_bytes) || 0;
  const storageUsedPercent = storageLimitBytes > 0
    ? Math.round((storageUsedBytes / storageLimitBytes) * 10000) / 100
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
    totalUsers: users.total,
    activeUsers: users.active,
    storageUsedBytes,
    storageLimitBytes,
    storageUsedPercent,
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
