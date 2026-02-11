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
jest.mock('../../models/taskPhoto.model');
jest.mock('../../services/storage.service');
jest.mock('../../services/storageTracking.service');
jest.mock('../../services/thumbnail.service');
jest.mock('../../services/audit.service');

import * as projectModel from '../../models/project.model';
import * as taskModel from '../../models/task.model';
import * as taskPhotoModel from '../../models/taskPhoto.model';
import * as storageService from '../../services/storage.service';
import * as storageTracking from '../../services/storageTracking.service';
import * as thumbnailService from '../../services/thumbnail.service';

describe('Task Photo Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (projectModel.findProjectById as jest.Mock).mockResolvedValue({
      id: 'p-1', organization_id: 'org-1', name: 'Test Project',
    });
    (taskModel.findTaskById as jest.Mock).mockResolvedValue({
      id: 't-1', project_id: 'p-1', status: 'open', created_by: 'user-1',
    });
  });

  describe('GET /api/v1/projects/:projectId/tasks/:taskId/photos', () => {
    it('should return photos for a task', async () => {
      (taskPhotoModel.findPhotosByTask as jest.Mock).mockResolvedValue([
        {
          id: 'ph-1', task_id: 't-1',
          file_url: 'photos/org-1/t-1/ph-1/photo.jpg',
          file_size_bytes: 2000000,
          thumbnail_url: 'photos/org-1/t-1/ph-1/thumb_photo.jpg',
        },
      ]);
      (storageService.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/signed-url',
      );

      const res = await request(app).get('/api/v1/projects/p-1/tasks/t-1/photos');

      expect(res.status).toBe(200);
      expect(res.body.data.photos).toHaveLength(1);
      expect(res.body.data.photos[0].download_url).toBe('https://s3.example.com/signed-url');
    });

    it('should return 404 if task not found', async () => {
      (taskModel.findTaskById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/projects/p-1/tasks/bad-id/photos');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/:projectId/tasks/:taskId/photos/upload-url', () => {
    it('should return presigned upload URL for photo', async () => {
      (storageTracking.checkStorageLimit as jest.Mock).mockResolvedValue({
        allowed: true, usedBytes: 0, limitBytes: 10737418240,
      });
      (taskPhotoModel.createTaskPhoto as jest.Mock).mockResolvedValue({
        id: 'ph-new', task_id: 't-1',
        file_url: 'photos/org-1/t-1/ph-new/photo.jpg',
        file_size_bytes: 2000000,
      });
      (storageService.generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload-url',
        key: 'photos/org-1/t-1/ph-new/photo.jpg',
        expiresAt: '2025-01-01T00:15:00.000Z',
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/upload-url')
        .send({
          fileName: 'photo.jpg',
          fileSize: 2000000,
          mimeType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.uploadUrl).toBe('https://s3.example.com/upload-url');
      expect(res.body.data.photoId).toBe('ph-new');
    });

    it('should reject if storage limit exceeded', async () => {
      (storageTracking.checkStorageLimit as jest.Mock).mockResolvedValue({
        allowed: false, usedBytes: 10737418240, limitBytes: 10737418240,
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/upload-url')
        .send({
          fileName: 'photo.jpg',
          fileSize: 2000000,
          mimeType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('STORAGE_LIMIT_EXCEEDED');
    });

    it('should reject invalid mime type', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/upload-url')
        .send({
          fileName: 'doc.pdf',
          fileSize: 1000000,
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(400);
    });

    it('should reject photos exceeding 10 MB', async () => {
      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/upload-url')
        .send({
          fileName: 'huge.jpg',
          fileSize: 11 * 1024 * 1024,
          mimeType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/projects/:projectId/tasks/:taskId/photos/:photoId/confirm', () => {
    it('should confirm upload and generate thumbnail', async () => {
      (taskPhotoModel.findPhotoById as jest.Mock).mockResolvedValue({
        id: 'ph-1', task_id: 't-1',
        file_url: 'photos/org-1/t-1/ph-1/photo.jpg',
        file_size_bytes: 2000000,
      });
      (storageService.checkFileExists as jest.Mock).mockResolvedValue(2000000);
      (thumbnailService.generateThumbnail as jest.Mock).mockResolvedValue(
        'photos/org-1/t-1/ph-1/thumb_photo.jpg',
      );
      (taskPhotoModel.updatePhotoAfterConfirm as jest.Mock).mockResolvedValue({
        id: 'ph-1', task_id: 't-1',
        file_url: 'photos/org-1/t-1/ph-1/photo.jpg',
        thumbnail_url: 'photos/org-1/t-1/ph-1/thumb_photo.jpg',
      });

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/ph-1/confirm');

      expect(res.status).toBe(200);
      expect(thumbnailService.generateThumbnail).toHaveBeenCalledWith(
        'photos/org-1/t-1/ph-1/photo.jpg',
        'photo',
      );
      expect(storageTracking.incrementStorageUsed).toHaveBeenCalledWith('org-1', 2000000);
    });

    it('should return 400 if file not uploaded', async () => {
      (taskPhotoModel.findPhotoById as jest.Mock).mockResolvedValue({
        id: 'ph-1', task_id: 't-1',
        file_url: 'photos/org-1/t-1/ph-1/photo.jpg',
        file_size_bytes: 2000000,
      });
      (storageService.checkFileExists as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/ph-1/confirm');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_NOT_UPLOADED');
    });

    it('should return 404 for non-existent photo', async () => {
      (taskPhotoModel.findPhotoById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/projects/p-1/tasks/t-1/photos/nonexistent/confirm');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/tasks/:taskId/photos/:photoId', () => {
    it('should delete a photo', async () => {
      (taskPhotoModel.findPhotoById as jest.Mock).mockResolvedValue({
        id: 'ph-1', task_id: 't-1',
        file_url: 'photos/org-1/t-1/ph-1/photo.jpg',
        thumbnail_url: 'photos/org-1/t-1/ph-1/thumb_photo.jpg',
        file_size_bytes: 2000000,
      });
      (taskPhotoModel.deleteTaskPhoto as jest.Mock).mockResolvedValue({
        id: 'ph-1',
      });

      const res = await request(app).delete('/api/v1/projects/p-1/tasks/t-1/photos/ph-1');

      expect(res.status).toBe(200);
      expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
      expect(storageTracking.decrementStorageUsed).toHaveBeenCalledWith('org-1', 2000000);
    });

    it('should return 404 for non-existent photo', async () => {
      (taskPhotoModel.findPhotoById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).delete('/api/v1/projects/p-1/tasks/t-1/photos/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
