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
jest.mock('../../models/protocol.model');
jest.mock('../../services/storage.service');
jest.mock('../../services/protocol.service');
jest.mock('../../services/audit.service');

import * as projectModel from '../../models/project.model';
import * as protocolModel from '../../models/protocol.model';
import * as storageService from '../../services/storage.service';
import * as protocolService from '../../services/protocol.service';

describe('Protocol Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: 'p-1', organization_id: 'org-1', name: 'Test Project',
    });
  });

  describe('GET /api/v1/projects/:projectId/protocols', () => {
    it('should return protocols for a project', async () => {
      (protocolModel.findProtocolsByProject as jest.Mock).mockResolvedValue([
        {
          id: 'proto-1', project_id: 'p-1', name: 'Monthly Report',
          status: 'completed', file_url: 'protocols/org-1/p-1/proto-1/report.pdf',
        },
        {
          id: 'proto-2', project_id: 'p-1', name: 'Generating...',
          status: 'generating', file_url: null,
        },
      ]);
      (storageService.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const res = await request(app).get('/api/v1/projects/p-1/protocols');

      expect(res.status).toBe(200);
      expect(res.body.data.protocols).toHaveLength(2);
      expect(res.body.data.protocols[0].download_url).toBe('https://s3.example.com/download');
      expect(res.body.data.protocols[1].download_url).toBeNull();
    });

    it('should return 404 if project not found', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/bad-id/protocols');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/:projectId/protocols/generate', () => {
    it('should start protocol generation and return 202', async () => {
      (protocolService.startProtocolGeneration as jest.Mock).mockResolvedValue('proto-new');

      const res = await request(app)
        .post('/api/v1/projects/p-1/protocols/generate')
        .send({ name: 'Test Protocol', filters: { status: 'open' } });

      expect(res.status).toBe(202);
      expect(res.body.data.protocolId).toBe('proto-new');
      expect(res.body.data.status).toBe('generating');
    });

    it('should reject without name', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/protocols/generate')
        .send({ filters: {} });

      expect(res.status).toBe(400);
    });

    it('should accept without filters', async () => {
      (protocolService.startProtocolGeneration as jest.Mock).mockResolvedValue('proto-new');

      const res = await request(app)
        .post('/api/v1/projects/p-1/protocols/generate')
        .send({ name: 'All Tasks Report' });

      expect(res.status).toBe(202);
    });
  });

  describe('GET /api/v1/projects/:projectId/protocols/:protocolId', () => {
    it('should return protocol details with download URL', async () => {
      (protocolModel.findProtocolById as jest.Mock).mockResolvedValue({
        id: 'proto-1', project_id: 'p-1', name: 'Report',
        status: 'completed', file_url: 'protocols/org-1/p-1/proto-1/report.pdf',
        file_size_bytes: 50000,
      });
      (storageService.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const res = await request(app).get('/api/v1/projects/p-1/protocols/proto-1');

      expect(res.status).toBe(200);
      expect(res.body.data.protocol.download_url).toBe('https://s3.example.com/download');
    });

    it('should return protocol with null download_url when generating', async () => {
      (protocolModel.findProtocolById as jest.Mock).mockResolvedValue({
        id: 'proto-1', project_id: 'p-1', name: 'Report',
        status: 'generating', file_url: null,
      });

      const res = await request(app).get('/api/v1/projects/p-1/protocols/proto-1');

      expect(res.status).toBe(200);
      expect(res.body.data.protocol.download_url).toBeNull();
    });

    it('should return 404 for non-existent protocol', async () => {
      (protocolModel.findProtocolById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/p-1/protocols/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
