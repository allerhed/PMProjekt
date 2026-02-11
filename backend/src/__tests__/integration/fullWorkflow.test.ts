import request from 'supertest';

// Mock express-rate-limit to bypass rate limiting in tests
jest.mock('express-rate-limit', () => {
  return () => (_req: unknown, _res: unknown, next: () => void) => next();
});

// Mock the database module
jest.mock('../../config/database', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return { __esModule: true, default: mockPool };
});

// Mock models
jest.mock('../../models/user.model');
jest.mock('../../models/organization.model');
jest.mock('../../models/project.model');
jest.mock('../../models/task.model');
jest.mock('../../models/comment.model');
jest.mock('../../models/passwordResetToken.model');
jest.mock('../../services/audit.service');
jest.mock('../../services/stats.service');

import app from '../../app';
import pool from '../../config/database';
import * as userModel from '../../models/user.model';
import * as orgModel from '../../models/organization.model';
import * as projectModel from '../../models/project.model';
import * as taskModel from '../../models/task.model';
import * as commentModel from '../../models/comment.model';
import * as statsService from '../../services/stats.service';
import { hashPassword } from '../../utils/password';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Full Workflow Integration', () => {
  const agent = request.agent(app);

  const testUser = {
    email: `integration-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Integration',
    lastName: 'Test',
    organizationName: `Test Org ${Date.now()}`,
    subdomain: `test-${Date.now()}`,
  };

  const orgId = 'org-integration-1';
  const userId = 'user-integration-1';
  let projectId: string;
  let taskId: string;
  let taskId2: string;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock findUserById for authenticate middleware (called on every request)
    (userModel.findUserById as jest.Mock).mockResolvedValue({
      id: userId,
      organization_id: orgId,
      email: testUser.email,
      first_name: testUser.firstName,
      last_name: testUser.lastName,
      role: 'org_admin',
      is_active: true,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Step 1: Register a new organization + admin user
  // ──────────────────────────────────────────────────────────────
  it('should register a new organization and admin user', async () => {
    (orgModel.findOrganizationBySubdomain as jest.Mock).mockResolvedValue(null);
    (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: orgId, name: testUser.organizationName, subdomain: testUser.subdomain }],
        }) // INSERT org
        .mockResolvedValueOnce({
          rows: [{
            id: userId,
            organization_id: orgId,
            email: testUser.email,
            first_name: testUser.firstName,
            last_name: testUser.lastName,
            role: 'org_admin',
            is_active: true,
            password_hash: 'hashed',
            failed_login_attempts: 0,
            locked_until: null,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        }) // INSERT user
        .mockResolvedValueOnce(undefined), // COMMIT
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    const res = await agent
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.organization).toBeDefined();

    // Check HttpOnly cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const tokenCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('token='))
      : cookies;
    expect(tokenCookie).toContain('HttpOnly');
  });

  // ──────────────────────────────────────────────────────────────
  // Step 2: Login as the admin
  // ──────────────────────────────────────────────────────────────
  it('should login as the admin user', async () => {
    const hash = await hashPassword(testUser.password);

    (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
      id: userId,
      organization_id: orgId,
      email: testUser.email,
      password_hash: hash,
      first_name: testUser.firstName,
      last_name: testUser.lastName,
      role: 'org_admin',
      is_active: true,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (userModel.resetFailedLogins as jest.Mock).mockResolvedValue(undefined);
    (userModel.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
    (userModel.isAccountLocked as jest.Mock).mockResolvedValue(false);

    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.password_hash).toBeUndefined();

    // Verify cookie was set for session persistence
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Step 3: Create a project
  // ──────────────────────────────────────────────────────────────
  it('should create a project', async () => {
    projectId = 'proj-integration-1';

    (projectModel.createProject as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
      description: 'A project for integration testing',
      address: '123 Test Street',
      status: 'active',
      start_date: '2025-01-01',
      target_completion_date: '2025-12-31',
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await agent
      .post('/api/v1/projects')
      .send({
        name: 'Integration Test Project',
        description: 'A project for integration testing',
        address: '123 Test Street',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project).toBeDefined();
    expect(res.body.data.project.name).toBe('Integration Test Project');
    expect(res.body.data.project.id).toBe(projectId);
  });

  // ──────────────────────────────────────────────────────────────
  // Step 4: Create tasks with different trades and priorities
  // ──────────────────────────────────────────────────────────────
  it('should create a high-priority electrical task', async () => {
    taskId = 'task-integration-1';

    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.createTask as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      title: 'Install main panel',
      description: 'Install the main electrical panel in the basement',
      status: 'open',
      priority: 'high',
      trade: 'Electrical',
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await agent
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({
        title: 'Install main panel',
        description: 'Install the main electrical panel in the basement',
        priority: 'high',
        trade: 'Electrical',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.title).toBe('Install main panel');
    expect(res.body.data.task.trade).toBe('Electrical');
    expect(res.body.data.task.priority).toBe('high');
    expect(res.body.data.task.status).toBe('open');
  });

  it('should create a normal-priority plumbing task', async () => {
    taskId2 = 'task-integration-2';

    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.createTask as jest.Mock).mockResolvedValue({
      id: taskId2,
      project_id: projectId,
      title: 'Fix leaking pipe',
      description: 'Repair the leaking pipe in bathroom 2',
      status: 'open',
      priority: 'normal',
      trade: 'Plumbing',
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await agent
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({
        title: 'Fix leaking pipe',
        description: 'Repair the leaking pipe in bathroom 2',
        priority: 'normal',
        trade: 'Plumbing',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe('Fix leaking pipe');
    expect(res.body.data.task.trade).toBe('Plumbing');
    expect(res.body.data.task.priority).toBe('normal');
  });

  it('should create a critical task with contractor assignment', async () => {
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.createTask as jest.Mock).mockResolvedValue({
      id: 'task-integration-3',
      project_id: projectId,
      title: 'Emergency HVAC repair',
      status: 'open',
      priority: 'critical',
      trade: 'HVAC',
      assigned_to_contractor_email: 'contractor@external.com',
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await agent
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({
        title: 'Emergency HVAC repair',
        priority: 'critical',
        trade: 'HVAC',
        assignedToContractorEmail: 'contractor@external.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.task.priority).toBe('critical');
    expect(res.body.data.task.assigned_to_contractor_email).toBe('contractor@external.com');
  });

  // ──────────────────────────────────────────────────────────────
  // Step 5: Update task status through transitions
  //   open -> in_progress -> completed -> verified
  // ──────────────────────────────────────────────────────────────
  it('should transition task from open to in_progress', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'open',
      created_by: userId,
    });
    (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
    (taskModel.updateTask as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'in_progress',
      updated_at: new Date(),
    });

    const res = await agent
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.status).toBe('in_progress');
  });

  it('should transition task from in_progress to completed', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'in_progress',
      created_by: userId,
    });
    (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
    (taskModel.updateTask as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date(),
    });

    const res = await agent
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('completed');
    expect(res.body.data.task.completed_at).toBeDefined();
  });

  it('should transition task from completed to verified', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'completed',
      created_by: userId,
    });
    (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
    (taskModel.updateTask as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'verified',
      completed_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      updated_at: new Date(),
    });

    const res = await agent
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('verified');
    expect(res.body.data.task.verified_at).toBeDefined();
  });

  it('should reject invalid status transition (open -> verified)', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId2,
      project_id: projectId,
      status: 'open',
      created_by: userId,
    });
    (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(false);

    const res = await agent
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId2}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  // ──────────────────────────────────────────────────────────────
  // Step 6: Add a comment to a task
  // ──────────────────────────────────────────────────────────────
  it('should add a comment to a task', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'verified',
    });
    (commentModel.createComment as jest.Mock).mockResolvedValue({
      id: 'comment-1',
      task_id: taskId,
      user_id: userId,
      external_email: null,
      comment_text: 'Work has been verified on site.',
      created_at: new Date(),
    });

    const res = await agent
      .post(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
      .send({ commentText: 'Work has been verified on site.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comment).toBeDefined();
    expect(res.body.data.comment.comment_text).toBe('Work has been verified on site.');
    expect(res.body.data.comment.task_id).toBe(taskId);
  });

  it('should reject a comment without text', async () => {
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      project_id: projectId,
      status: 'verified',
    });

    const res = await agent
      .post(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ──────────────────────────────────────────────────────────────
  // Step 7: List projects (verify task counts returned)
  // ──────────────────────────────────────────────────────────────
  it('should list projects with task counts', async () => {
    (projectModel.findProjectsByOrganization as jest.Mock).mockResolvedValue({
      projects: [
        {
          id: projectId,
          organization_id: orgId,
          name: 'Integration Test Project',
          status: 'active',
          total_tasks: 3,
          open_tasks: 1,
          in_progress_tasks: 0,
          completed_tasks: 0,
          verified_tasks: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      total: 1,
    });

    const res = await agent.get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].total_tasks).toBe(3);
    expect(res.body.data.projects[0].open_tasks).toBe(1);
    expect(res.body.data.projects[0].verified_tasks).toBe(2);
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.total).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────
  // Step 8: List tasks with filters (by status, trade)
  // ──────────────────────────────────────────────────────────────
  it('should list tasks filtered by status', async () => {
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
      tasks: [
        { id: taskId2, title: 'Fix leaking pipe', status: 'open', trade: 'Plumbing' },
      ],
      total: 1,
    });

    const res = await agent
      .get(`/api/v1/projects/${projectId}/tasks?status=open`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].status).toBe('open');

    // Verify the model was called with the correct status filter
    expect(taskModel.findTasksByProject).toHaveBeenCalledWith(
      projectId,
      expect.any(String),
      expect.objectContaining({ status: 'open' }),
      expect.any(Object),
    );
  });

  it('should list tasks filtered by trade', async () => {
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
      tasks: [
        { id: taskId, title: 'Install main panel', status: 'verified', trade: 'Electrical' },
      ],
      total: 1,
    });

    const res = await agent
      .get(`/api/v1/projects/${projectId}/tasks?trade=Electrical`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].trade).toBe('Electrical');

    expect(taskModel.findTasksByProject).toHaveBeenCalledWith(
      projectId,
      expect.any(String),
      expect.objectContaining({ trade: 'Electrical' }),
      expect.any(Object),
    );
  });

  it('should list tasks filtered by both status and trade', async () => {
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
      tasks: [],
      total: 0,
    });

    const res = await agent
      .get(`/api/v1/projects/${projectId}/tasks?status=open&trade=Electrical`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(0);

    expect(taskModel.findTasksByProject).toHaveBeenCalledWith(
      projectId,
      expect.any(String),
      expect.objectContaining({ status: 'open', trade: 'Electrical' }),
      expect.any(Object),
    );
  });

  // ──────────────────────────────────────────────────────────────
  // Step 9: Verify pagination works
  // ──────────────────────────────────────────────────────────────
  it('should support pagination on project listing', async () => {
    (projectModel.findProjectsByOrganization as jest.Mock).mockResolvedValue({
      projects: [
        { id: 'p-1', name: 'Project 1', status: 'active', total_tasks: 2 },
      ],
      total: 3,
    });

    const res = await agent.get('/api/v1/projects?page=1&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.total).toBe(3);
    expect(res.body.meta.pagination.page).toBe(1);
    expect(res.body.meta.pagination.limit).toBe(1);
    expect(res.body.meta.pagination.totalPages).toBe(3);
  });

  it('should support pagination on task listing', async () => {
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      organization_id: orgId,
      name: 'Integration Test Project',
    });
    (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
      tasks: [
        { id: 't-1', title: 'Task 1', status: 'open' },
      ],
      total: 5,
    });

    const res = await agent
      .get(`/api/v1/projects/${projectId}/tasks?page=2&limit=1`);

    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.total).toBe(5);
    expect(res.body.meta.pagination.page).toBe(2);
    expect(res.body.meta.pagination.limit).toBe(1);
    expect(res.body.meta.pagination.totalPages).toBe(5);
  });

  // ──────────────────────────────────────────────────────────────
  // Step 10: Verify admin can access admin endpoints
  // ──────────────────────────────────────────────────────────────
  it('should allow org_admin to access admin stats', async () => {
    (statsService.getOrgStats as jest.Mock).mockResolvedValue({
      totalProjects: 1,
      activeProjects: 1,
      completedProjects: 0,
      totalTasks: 3,
      openTasks: 1,
      inProgressTasks: 0,
      completedTasks: 0,
      verifiedTasks: 2,
      totalUsers: 1,
      activeUsers: 1,
      storageUsedBytes: 0,
      storageLimitBytes: 10737418240,
      storageUsedPercent: 0,
    });

    const res = await agent.get('/api/v1/admin/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalProjects).toBe(1);
    expect(res.body.data.totalTasks).toBe(3);
  });

  it('should allow org_admin to access admin activity', async () => {
    (statsService.getRecentActivity as jest.Mock).mockResolvedValue([
      {
        id: 'audit-1',
        userId: userId,
        action: 'task.created',
        resourceType: 'task',
        resourceId: taskId,
        metadata: { projectId },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      },
    ]);

    const res = await agent.get('/api/v1/admin/activity');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].action).toBe('task.created');
  });

  // ──────────────────────────────────────────────────────────────
  // Supplementary: Verify unauthenticated access is denied
  // ──────────────────────────────────────────────────────────────
  it('should deny access to projects without authentication', async () => {
    // Use a fresh supertest instance without cookie jar
    const unauthRes = await request(app).get('/api/v1/projects');

    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.success).toBe(false);
  });

  it('should deny access to tasks without authentication', async () => {
    const unauthRes = await request(app).get(`/api/v1/projects/${projectId}/tasks`);

    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.success).toBe(false);
  });
});
