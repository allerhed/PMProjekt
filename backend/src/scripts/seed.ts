import pool from '../config/database';
import { hashPassword } from '../utils/password';

async function seed() {
  console.log('Seeding database...\n');

  try {
    const passwordHash = await hashPassword('Password123!');

    // Create organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, subdomain) VALUES ($1, $2)
       ON CONFLICT (subdomain) DO UPDATE SET name = $1
       RETURNING id`,
      ['Demo Construction Co', 'demo'],
    );
    const orgId = orgResult.rows[0].id;

    // Create users
    const users = [
      { email: 'super@demo.com', firstName: 'Super', lastName: 'Admin', role: 'super_admin' },
      { email: 'admin@demo.com', firstName: 'Org', lastName: 'Admin', role: 'org_admin' },
      { email: 'pm@demo.com', firstName: 'Project', lastName: 'Manager', role: 'project_manager' },
      { email: 'field@demo.com', firstName: 'Field', lastName: 'User', role: 'field_user' },
      { email: 'field2@demo.com', firstName: 'Field', lastName: 'Worker', role: 'field_user' },
    ];

    const userIds: Record<string, string> = {};
    for (const u of users) {
      const result = await pool.query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET password_hash = $3
         RETURNING id`,
        [orgId, u.email, passwordHash, u.firstName, u.lastName, u.role],
      );
      userIds[u.role === 'field_user' && u.email === 'field2@demo.com' ? 'field_user_2' : u.role] = result.rows[0].id;
    }

    // Create projects
    const p1Result = await pool.query(
      `INSERT INTO projects (organization_id, name, description, address, status, start_date, target_completion_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [orgId, 'Riverside Tower Renovation', 'Complete interior renovation of 12-story residential tower',
       '123 River Street, Stockholm', 'active', '2026-01-15', '2026-06-30', userIds.project_manager],
    );
    const p2Result = await pool.query(
      `INSERT INTO projects (organization_id, name, description, address, status, start_date, target_completion_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [orgId, 'Harbor Bridge Repair', 'Structural repair and waterproofing of pedestrian bridge',
       '45 Harbor Avenue, Gothenburg', 'active', '2026-02-01', '2026-04-30', userIds.project_manager],
    );
    const p1 = p1Result.rows[0].id;
    const p2 = p2Result.rows[0].id;

    // Create tasks
    const tasks = [
      { project: p1, title: 'Replace elevator control panel', trade: 'Electrical', priority: 'critical', status: 'open' },
      { project: p1, title: 'Fix water leak in apt 3B bathroom', trade: 'Plumbing', priority: 'high', status: 'in_progress' },
      { project: p1, title: 'Repaint hallway floors 1-6', trade: 'Painting', priority: 'normal', status: 'open' },
      { project: p1, title: 'Install fire alarm sensors', trade: 'Electrical', priority: 'critical', status: 'open' },
      { project: p1, title: 'Replace broken window apt 7A', trade: 'Glazing', priority: 'high', status: 'completed' },
      { project: p1, title: 'Patch drywall damage in lobby', trade: 'Drywall', priority: 'normal', status: 'verified' },
      { project: p2, title: 'Remove corroded railing sections', trade: 'Structural', priority: 'high', status: 'in_progress' },
      { project: p2, title: 'Apply waterproof membrane to deck', trade: 'Waterproofing', priority: 'critical', status: 'open' },
      { project: p2, title: 'Repaint bridge surface markings', trade: 'Painting', priority: 'low', status: 'open' },
      { project: p2, title: 'Inspect foundation anchors', trade: 'Structural', priority: 'high', status: 'completed' },
    ];

    const taskIds: string[] = [];
    for (const t of tasks) {
      const result = await pool.query(
        `INSERT INTO tasks (project_id, task_number, title, trade, priority, status, created_by, assigned_to_user, completed_at, verified_at)
         VALUES ($1, (SELECT COALESCE(MAX(task_number), 0) + 1 FROM tasks WHERE project_id = $1), $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [t.project, t.title, t.trade, t.priority, t.status, userIds.project_manager, userIds.field_user,
         t.status === 'completed' || t.status === 'verified' ? new Date() : null,
         t.status === 'verified' ? new Date() : null],
      );
      taskIds.push(result.rows[0].id);
    }

    // Create comments
    const comments = [
      { taskId: taskIds[0], userId: userIds.project_manager, text: 'Elevator vendor confirmed delivery next week' },
      { taskId: taskIds[0], userId: userIds.field_user, text: 'Current panel is intermittently failing, needs urgent replacement' },
      { taskId: taskIds[1], userId: userIds.field_user, text: 'Leak appears to be from the shower drain seal' },
      { taskId: taskIds[4], userId: userIds.project_manager, text: 'Window replaced and inspected, closing task' },
      { taskId: taskIds[6], userId: userIds.field_user, text: 'Removed 3 of 8 sections so far' },
    ];

    for (const c of comments) {
      await pool.query(
        'INSERT INTO task_comments (task_id, user_id, comment_text) VALUES ($1, $2, $3)',
        [c.taskId, c.userId, c.text],
      );
    }

    console.log(`Created: 1 org, 5 users, 2 projects, ${tasks.length} tasks, ${comments.length} comments`);
    console.log('\n--- Login Credentials (all password: Password123!) ---');
    console.log('super@demo.com    (super_admin)');
    console.log('admin@demo.com    (org_admin)');
    console.log('pm@demo.com       (project_manager)');
    console.log('field@demo.com    (field_user)');
    console.log('field2@demo.com   (field_user)');
    console.log('\nSeed complete!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
