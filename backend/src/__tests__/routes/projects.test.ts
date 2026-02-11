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
jest.mock('../../services/audit.service');

import * as projectModel from '../../models/project.model';

describe('Project Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/v1/projects', () => {
    it('should return paginated projects', async () => {
      (projectModel.findProjectsByOrganization as jest.Mock).mockResolvedValue({
        projects: [{ id: 'p-1', name: 'Test Project', status: 'active', total_tasks: 5 }],
        total: 1,
      });

      const res = await request(app).get('/api/v1/projects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBe(1);
    });

    it('should pass status filter to model', async () => {
      (projectModel.findProjectsByOrganization as jest.Mock).mockResolvedValue({
        projects: [], total: 0,
      });

      await request(app).get('/api/v1/projects?status=completed');

      expect(projectModel.findProjectsByOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a project', async () => {
      (projectModel.createProject as jest.Mock).mockResolvedValue({
        id: 'p-new', name: 'New Project', organization_id: 'org-1', status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'New Project', description: 'Test', address: '123 Street' });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe('New Project');
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/projects/:projectId', () => {
    it('should return project detail', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue({
        id: 'p-1', name: 'Test', total_tasks: 10,
      });

      const res = await request(app).get('/api/v1/projects/p-1');

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe('p-1');
    });

    it('should return 404 for non-existent project', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/projects/:projectId', () => {
    it('should update project', async () => {
      (projectModel.updateProject as jest.Mock).mockResolvedValue({
        id: 'p-1', name: 'Updated', status: 'active',
      });

      const res = await request(app)
        .patch('/api/v1/projects/p-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.project.name).toBe('Updated');
    });
  });

  describe('DELETE /api/v1/projects/:projectId', () => {
    it('should reject for project_manager (only org_admin/super_admin can delete)', async () => {
      const res = await request(app).delete('/api/v1/projects/p-1');
      expect(res.status).toBe(403);
    });
  });
});
