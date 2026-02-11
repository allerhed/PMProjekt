import request from 'supertest';
import app from '../../app';

jest.mock('express-rate-limit', () => {
  return () => (_req: unknown, _res: unknown, next: () => void) => next();
});

jest.mock('../../config/database', () => {
  const mockPool = { query: jest.fn(), connect: jest.fn() };
  return { __esModule: true, default: mockPool };
});

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = {
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'project_manager',
      email: 'pm@test.com',
    };
    next();
  },
}));

jest.mock('../../models/project.model');
jest.mock('../../models/task.model');
jest.mock('../../services/audit.service');

import * as projectModel from '../../models/project.model';
import * as taskModel from '../../models/task.model';

describe('Task Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: 'p-1', organization_id: 'org-1', name: 'Test Project',
    });
  });

  describe('GET /api/v1/projects/:projectId/tasks', () => {
    it('should return filtered tasks', async () => {
      (taskModel.findTasksByProject as jest.Mock).mockResolvedValue({
        tasks: [{ id: 't-1', title: 'Fix pipe', status: 'open' }],
        total: 1,
      });

      const res = await request(app).get('/api/v1/projects/p-1/tasks?status=open');

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toHaveLength(1);
    });

    it('should return 404 if project not found', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/bad-id/tasks');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/:projectId/tasks', () => {
    it('should create a task', async () => {
      (taskModel.createTask as jest.Mock).mockResolvedValue({
        id: 't-new', title: 'New Task', status: 'open', project_id: 'p-1',
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks')
        .send({ title: 'New Task', trade: 'Electrical', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body.data.task.title).toBe('New Task');
    });

    it('should reject task without title', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks')
        .send({ trade: 'Electrical' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/projects/:projectId/tasks/:taskId', () => {
    it('should update task status with valid transition', async () => {
      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: 't-1', project_id: 'p-1', status: 'open', created_by: 'user-1',
      });
      (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
      (taskModel.updateTask as jest.Mock).mockResolvedValue({
        id: 't-1', status: 'in_progress',
      });

      const res = await request(app)
        .patch('/api/v1/projects/p-1/tasks/t-1')
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
    });

    it('should reject invalid status transition', async () => {
      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: 't-1', project_id: 'p-1', status: 'open', created_by: 'user-1',
      });
      (taskModel.isValidStatusTransition as jest.Mock).mockReturnValue(false);

      const res = await request(app)
        .patch('/api/v1/projects/p-1/tasks/t-1')
        .send({ status: 'verified' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('should return 404 for non-existent task', async () => {
      (taskModel.findTaskById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/projects/p-1/tasks/nonexistent')
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/tasks/:taskId', () => {
    it('should delete a task', async () => {
      (taskModel.findTaskById as jest.Mock).mockResolvedValue({
        id: 't-1', project_id: 'p-1',
      });
      (taskModel.deleteTask as jest.Mock).mockResolvedValue(true);

      const res = await request(app).delete('/api/v1/projects/p-1/tasks/t-1');

      expect(res.status).toBe(200);
    });
  });
});
