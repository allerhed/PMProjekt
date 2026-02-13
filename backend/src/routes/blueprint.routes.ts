import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { requestBlueprintUploadSchema } from '../validators/upload.validators';
import * as blueprintModel from '../models/blueprint.model';
import * as projectModel from '../models/project.model';
import * as storageService from '../services/storage.service';
import * as storageTracking from '../services/storageTracking.service';
import * as thumbnailService from '../services/thumbnail.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All blueprint routes require authentication
router.use(authenticate);

// Helper: verify project access
async function verifyProjectAccess(req: Request, res: Response): Promise<boolean> {
  const project = await projectModel.findProjectById(
    param(req.params.projectId),
    req.user!.organizationId,
  );
  if (!project) {
    sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return false;
  }
  return true;
}

// GET /api/v1/projects/:projectId/blueprints — list blueprints
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;

    const blueprints = await blueprintModel.findBlueprintsByProject(
      param(req.params.projectId),
      req.user!.organizationId,
    );

    // Generate download URLs for each blueprint
    const blueprintsWithUrls = await Promise.all(
      blueprints.map(async (bp) => ({
        ...bp,
        download_url: await storageService.generatePresignedDownloadUrl(bp.file_url),
        thumbnail_download_url: bp.thumbnail_url
          ? await storageService.generatePresignedDownloadUrl(bp.thumbnail_url)
          : null,
      })),
    );

    sendSuccess(res, { blueprints: blueprintsWithUrls });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/blueprints/upload-url — request presigned upload URL
router.post(
  '/upload-url',
  uploadLimiter,
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(requestBlueprintUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyProjectAccess(req, res))) return;

      const { fileName, fileSize, mimeType, name } = req.body;

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

      // Create pending blueprint record
      const blueprintId = randomUUID();
      const s3Key = storageService.buildS3Key(
        'blueprints',
        req.user!.organizationId,
        param(req.params.projectId),
        blueprintId,
        fileName,
      );

      // Create blueprint record with pending file_url (the S3 key)
      const blueprint = await blueprintModel.createBlueprint({
        projectId: param(req.params.projectId),
        name,
        fileUrl: s3Key,
        fileSizeBytes: fileSize,
        mimeType,
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
        blueprintId: blueprint.id,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/projects/:projectId/blueprints/:blueprintId/confirm — confirm upload
router.post(
  '/:blueprintId/confirm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyProjectAccess(req, res))) return;

      const blueprint = await blueprintModel.findBlueprintById(
        param(req.params.blueprintId),
        req.user!.organizationId,
      );

      if (!blueprint || blueprint.project_id !== param(req.params.projectId)) {
        sendError(res, 404, 'NOT_FOUND', 'Blueprint not found');
        return;
      }

      // Verify the file exists in S3
      const fileSize = await storageService.checkFileExists(blueprint.file_url);
      if (fileSize === null) {
        sendError(res, 400, 'FILE_NOT_UPLOADED', 'File has not been uploaded yet');
        return;
      }

      // Generate thumbnail (only for images, not PDFs)
      let thumbnailKey: string | undefined;
      if (blueprint.mime_type.startsWith('image/')) {
        try {
          thumbnailKey = await thumbnailService.generateThumbnail(
            blueprint.file_url,
            'blueprint',
          );
        } catch {
          // Thumbnail generation failure is non-fatal
        }
      }

      // Update blueprint record
      const updated = await blueprintModel.updateBlueprintAfterConfirm(blueprint.id, {
        fileUrl: blueprint.file_url,
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
        action: 'blueprint.uploaded',
        resourceType: 'blueprint',
        resourceId: blueprint.id,
        metadata: { projectId: param(req.params.projectId), fileSize },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { blueprint: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/projects/:projectId/blueprints/:blueprintId — delete blueprint
router.delete(
  '/:blueprintId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyProjectAccess(req, res))) return;

      const blueprint = await blueprintModel.findBlueprintById(
        param(req.params.blueprintId),
        req.user!.organizationId,
      );

      if (!blueprint || blueprint.project_id !== param(req.params.projectId)) {
        sendError(res, 404, 'NOT_FOUND', 'Blueprint not found');
        return;
      }

      // Prevent deletion if tasks have annotations on this blueprint
      const annotatedCount = await blueprintModel.countTasksWithAnnotations(blueprint.id);
      if (annotatedCount > 0) {
        sendError(res, 409, 'HAS_ANNOTATIONS', `Cannot delete blueprint with ${annotatedCount} annotated task(s). Remove the annotations first.`);
        return;
      }

      // Delete from S3
      try {
        await storageService.deleteObject(blueprint.file_url);
        if (blueprint.thumbnail_url) {
          await storageService.deleteObject(blueprint.thumbnail_url);
        }
      } catch {
        // S3 deletion failure is non-fatal — DB record is still cleaned up
      }

      // Delete from DB
      await blueprintModel.deleteBlueprint(blueprint.id);

      // Decrement storage
      await storageTracking.decrementStorageUsed(
        req.user!.organizationId,
        blueprint.file_size_bytes,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'blueprint.deleted',
        resourceType: 'blueprint',
        resourceId: blueprint.id,
        metadata: { projectId: param(req.params.projectId) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Blueprint deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
