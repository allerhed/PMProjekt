import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { uploadLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { requestPhotoUploadSchema } from '../validators/upload.validators';
import * as taskPhotoModel from '../models/taskPhoto.model';
import * as taskModel from '../models/task.model';
import * as projectModel from '../models/project.model';
import * as storageService from '../services/storage.service';
import * as storageTracking from '../services/storageTracking.service';
import * as thumbnailService from '../services/thumbnail.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All photo routes require authentication
router.use(authenticate);

// Helper: verify project and task access
async function verifyTaskAccess(
  req: Request,
  res: Response,
): Promise<boolean> {
  const project = await projectModel.findProjectById(
    param(req.params.projectId),
    req.user!.organizationId,
  );
  if (!project) {
    sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return false;
  }

  const task = await taskModel.findTaskById(
    param(req.params.taskId),
    req.user!.organizationId,
  );
  if (!task || task.project_id !== param(req.params.projectId)) {
    sendError(res, 404, 'NOT_FOUND', 'Task not found');
    return false;
  }

  return true;
}

// GET /api/v1/projects/:projectId/tasks/:taskId/photos — list photos
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyTaskAccess(req, res))) return;

    const photos = await taskPhotoModel.findPhotosByTask(
      param(req.params.taskId),
      req.user!.organizationId,
    );

    // Generate download URLs
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        download_url: await storageService.generatePresignedDownloadUrl(photo.file_url),
        thumbnail_download_url: photo.thumbnail_url
          ? await storageService.generatePresignedDownloadUrl(photo.thumbnail_url)
          : null,
      })),
    );

    sendSuccess(res, { photos: photosWithUrls });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/tasks/:taskId/photos/upload-url — request upload URL
router.post(
  '/upload-url',
  uploadLimiter,
  validate(requestPhotoUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyTaskAccess(req, res))) return;

      const { fileName, fileSize, mimeType, caption } = req.body;

      // Check storage limit
      const storageCheck = await storageTracking.checkStorageLimit(
        req.user!.organizationId,
        fileSize,
      );
      if (!storageCheck.allowed) {
        sendError(res, 400, 'STORAGE_LIMIT_EXCEEDED', 'Organization storage limit exceeded', {
          usedBytes: storageCheck.usedBytes,
          limitBytes: storageCheck.limitBytes,
        });
        return;
      }

      // Create pending photo record
      const photoId = randomUUID();
      const s3Key = storageService.buildS3Key(
        'photos',
        req.user!.organizationId,
        param(req.params.taskId),
        photoId,
        fileName,
      );

      const photo = await taskPhotoModel.createTaskPhoto({
        taskId: param(req.params.taskId),
        fileUrl: s3Key,
        fileSizeBytes: fileSize,
        caption,
        uploadedBy: req.user!.userId,
      });

      // Generate presigned upload URL
      const presigned = await storageService.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
      );

      sendSuccess(res, {
        uploadUrl: presigned.uploadUrl,
        photoId: photo.id,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/projects/:projectId/tasks/:taskId/photos/:photoId/confirm — confirm upload
router.post(
  '/:photoId/confirm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyTaskAccess(req, res))) return;

      const photo = await taskPhotoModel.findPhotoById(
        param(req.params.photoId),
        req.user!.organizationId,
      );

      if (!photo || photo.task_id !== param(req.params.taskId)) {
        sendError(res, 404, 'NOT_FOUND', 'Photo not found');
        return;
      }

      // Verify file exists in S3
      const fileSize = await storageService.checkFileExists(photo.file_url);
      if (fileSize === null) {
        sendError(res, 400, 'FILE_NOT_UPLOADED', 'File has not been uploaded yet');
        return;
      }

      // Generate thumbnail
      let thumbnailKey: string | undefined;
      try {
        thumbnailKey = await thumbnailService.generateThumbnail(
          photo.file_url,
          'photo',
        );
      } catch {
        // Thumbnail generation failure is non-fatal
      }

      // Update photo record
      const updated = await taskPhotoModel.updatePhotoAfterConfirm(photo.id, {
        fileUrl: photo.file_url,
        fileSizeBytes: fileSize,
        thumbnailUrl: thumbnailKey,
      });

      // Track storage usage
      await storageTracking.incrementStorageUsed(
        req.user!.organizationId,
        fileSize,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'photo.uploaded',
        resourceType: 'task_photo',
        resourceId: photo.id,
        metadata: { taskId: param(req.params.taskId), fileSize },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { photo: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/projects/:projectId/tasks/:taskId/photos/:photoId — delete photo
router.delete(
  '/:photoId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyTaskAccess(req, res))) return;

      const photo = await taskPhotoModel.findPhotoById(
        param(req.params.photoId),
        req.user!.organizationId,
      );

      if (!photo || photo.task_id !== param(req.params.taskId)) {
        sendError(res, 404, 'NOT_FOUND', 'Photo not found');
        return;
      }

      // Delete from S3
      try {
        await storageService.deleteObject(photo.file_url);
        if (photo.thumbnail_url) {
          await storageService.deleteObject(photo.thumbnail_url);
        }
      } catch {
        // S3 deletion failure is non-fatal
      }

      // Delete from DB
      await taskPhotoModel.deleteTaskPhoto(photo.id);

      // Decrement storage
      await storageTracking.decrementStorageUsed(
        req.user!.organizationId,
        photo.file_size_bytes,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'photo.deleted',
        resourceType: 'task_photo',
        resourceId: photo.id,
        metadata: { taskId: param(req.params.taskId) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Photo deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
