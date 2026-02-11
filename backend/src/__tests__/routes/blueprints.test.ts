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
jest.mock('../../models/blueprint.model');
jest.mock('../../services/storage.service');
jest.mock('../../services/storageTracking.service');
jest.mock('../../services/thumbnail.service');
jest.mock('../../services/audit.service');

import * as projectModel from '../../models/project.model';
import * as blueprintModel from '../../models/blueprint.model';
import * as storageService from '../../services/storage.service';
import * as storageTracking from '../../services/storageTracking.service';
import * as thumbnailService from '../../services/thumbnail.service';

describe('Blueprint Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: 'p-1', organization_id: 'org-1', name: 'Test Project',
    });
  });

  describe('GET /api/v1/projects/:projectId/blueprints', () => {
    it('should return blueprints for a project', async () => {
      (blueprintModel.findBlueprintsByProject as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1', project_id: 'p-1', name: 'Floor Plan',
          file_url: 'blueprints/org-1/p-1/bp-1/plan.jpg',
          file_size_bytes: 5000000, mime_type: 'image/jpeg',
          thumbnail_url: 'blueprints/org-1/p-1/bp-1/thumb_plan.jpg',
        },
      ]);
      (storageService.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/signed-url',
      );

      const res = await request(app).get('/api/v1/projects/p-1/blueprints');

      expect(res.status).toBe(200);
      expect(res.body.data.blueprints).toHaveLength(1);
      expect(res.body.data.blueprints[0].download_url).toBe('https://s3.example.com/signed-url');
    });

    it('should return 404 if project not found', async () => {
      (projectModel.findProjectById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/bad-id/blueprints');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/:projectId/blueprints/upload-url', () => {
    it('should return presigned upload URL', async () => {
      (storageTracking.checkStorageLimit as jest.Mock).mockResolvedValue({
        allowed: true, usedBytes: 0, limitBytes: 10737418240,
      });
      (blueprintModel.createBlueprint as jest.Mock).mockResolvedValue({
        id: 'bp-new', project_id: 'p-1', name: 'New Plan',
        file_url: 'blueprints/org-1/p-1/bp-new/plan.pdf',
        file_size_bytes: 1000000, mime_type: 'application/pdf',
      });
      (storageService.generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload-url',
        key: 'blueprints/org-1/p-1/bp-new/plan.pdf',
        expiresAt: '2025-01-01T00:15:00.000Z',
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/upload-url')
        .send({
          fileName: 'plan.pdf',
          fileSize: 1000000,
          mimeType: 'application/pdf',
          name: 'New Plan',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.uploadUrl).toBe('https://s3.example.com/upload-url');
      expect(res.body.data.blueprintId).toBe('bp-new');
    });

    it('should reject if storage limit exceeded', async () => {
      (storageTracking.checkStorageLimit as jest.Mock).mockResolvedValue({
        allowed: false, usedBytes: 10737418240, limitBytes: 10737418240,
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/upload-url')
        .send({
          fileName: 'plan.pdf',
          fileSize: 1000000,
          mimeType: 'application/pdf',
          name: 'New Plan',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('STORAGE_LIMIT_EXCEEDED');
    });

    it('should reject invalid file type', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/upload-url')
        .send({
          fileName: 'malware.exe',
          fileSize: 1000000,
          mimeType: 'application/x-executable',
          name: 'Not a blueprint',
        });

      expect(res.status).toBe(400);
    });

    it('should reject files exceeding size limit', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/upload-url')
        .send({
          fileName: 'huge.pdf',
          fileSize: 60 * 1024 * 1024, // 60 MB
          mimeType: 'application/pdf',
          name: 'Huge Plan',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/projects/:projectId/blueprints/:blueprintId/confirm', () => {
    it('should confirm upload and generate thumbnail', async () => {
      (blueprintModel.findBlueprintById as jest.Mock).mockResolvedValue({
        id: 'bp-1', project_id: 'p-1',
        file_url: 'blueprints/org-1/p-1/bp-1/plan.jpg',
        file_size_bytes: 5000000, mime_type: 'image/jpeg',
      });
      (storageService.checkFileExists as jest.Mock).mockResolvedValue(5000000);
      (thumbnailService.generateThumbnail as jest.Mock).mockResolvedValue(
        'blueprints/org-1/p-1/bp-1/thumb_plan.jpg',
      );
      (blueprintModel.updateBlueprintAfterConfirm as jest.Mock).mockResolvedValue({
        id: 'bp-1', project_id: 'p-1',
        file_url: 'blueprints/org-1/p-1/bp-1/plan.jpg',
        thumbnail_url: 'blueprints/org-1/p-1/bp-1/thumb_plan.jpg',
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/bp-1/confirm');

      expect(res.status).toBe(200);
      expect(thumbnailService.generateThumbnail).toHaveBeenCalledWith(
        'blueprints/org-1/p-1/bp-1/plan.jpg',
        'blueprint',
      );
      expect(storageTracking.incrementStorageUsed).toHaveBeenCalledWith('org-1', 5000000);
    });

    it('should return 400 if file not uploaded', async () => {
      (blueprintModel.findBlueprintById as jest.Mock).mockResolvedValue({
        id: 'bp-1', project_id: 'p-1',
        file_url: 'blueprints/org-1/p-1/bp-1/plan.jpg',
        file_size_bytes: 5000000, mime_type: 'image/jpeg',
      });
      (storageService.checkFileExists as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/projects/p-1/blueprints/bp-1/confirm');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_NOT_UPLOADED');
    });
  });

  describe('DELETE /api/v1/projects/:projectId/blueprints/:blueprintId', () => {
    it('should delete a blueprint', async () => {
      (blueprintModel.findBlueprintById as jest.Mock).mockResolvedValue({
        id: 'bp-1', project_id: 'p-1',
        file_url: 'blueprints/org-1/p-1/bp-1/plan.jpg',
        thumbnail_url: 'blueprints/org-1/p-1/bp-1/thumb_plan.jpg',
        file_size_bytes: 5000000,
      });
      (blueprintModel.deleteBlueprint as jest.Mock).mockResolvedValue({
        id: 'bp-1',
      });

      const res = await request(app).delete('/api/v1/projects/p-1/blueprints/bp-1');

      expect(res.status).toBe(200);
      expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
      expect(storageTracking.decrementStorageUsed).toHaveBeenCalledWith('org-1', 5000000);
    });

    it('should return 404 for non-existent blueprint', async () => {
      (blueprintModel.findBlueprintById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).delete('/api/v1/projects/p-1/blueprints/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
