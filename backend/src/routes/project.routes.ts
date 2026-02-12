import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { uploadLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validators';
import { requestPhotoUploadSchema } from '../validators/upload.validators';
import * as projectModel from '../models/project.model';
import * as storageService from '../services/storage.service';
import * as storageTracking from '../services/storageTracking.service';
import * as thumbnailService from '../services/thumbnail.service';
import { validateCustomFields } from '../services/customFieldValidation.service';
import { param } from '../utils/params';

const router = Router();

// All project routes require authentication
router.use(authenticate);

async function attachDownloadUrls(project: projectModel.ProjectWithStats) {
  return {
    ...project,
    image_download_url: project.image_url
      ? await storageService.generatePresignedDownloadUrl(project.image_url)
      : null,
    thumbnail_download_url: project.thumbnail_url
      ? await storageService.generatePresignedDownloadUrl(project.thumbnail_url)
      : null,
  };
}

// GET /api/v1/projects — list projects in user's org
router.get('/', parsePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const { projects, total } = await projectModel.findProjectsByOrganization(
      req.user!.organizationId,
      {
        status: status as string,
        limit: req.pagination!.limit,
        offset: req.pagination!.offset,
      },
    );

    const projectsWithUrls = await Promise.all(projects.map(attachDownloadUrls));

    sendSuccess(res, { projects: projectsWithUrls }, 200, {
      page: req.pagination!.page,
      limit: req.pagination!.limit,
      total,
      totalPages: Math.ceil(total / req.pagination!.limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects — create project
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(createProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate custom fields if provided
      let sanitizedCustomFields: Record<string, unknown> | undefined;
      if (req.body.customFields) {
        const cfResult = await validateCustomFields(req.user!.organizationId, 'project', req.body.customFields);
        if (!cfResult.valid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
          return;
        }
        sanitizedCustomFields = cfResult.sanitized;
      }

      const project = await projectModel.createProject({
        organizationId: req.user!.organizationId,
        name: req.body.name,
        description: req.body.description,
        address: req.body.address,
        startDate: req.body.startDate,
        targetCompletionDate: req.body.targetCompletionDate,
        responsibleUserId: req.body.responsibleUserId,
        customFields: sanitizedCustomFields,
        createdBy: req.user!.userId,
      });

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { project }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/projects/:projectId — get project detail
router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectModel.findProjectById(
      param(req.params.projectId),
      req.user!.organizationId,
    );

    if (!project) {
      sendError(res, 404, 'NOT_FOUND', 'Project not found');
      return;
    }

    const projectWithUrls = await attachDownloadUrls(project);

    sendSuccess(res, { project: projectWithUrls });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/projects/:projectId — update project
router.patch(
  '/:projectId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(updateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Map camelCase body to snake_case for DB
      const updates: Record<string, unknown> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.address !== undefined) updates.address = req.body.address;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.startDate !== undefined) updates.start_date = req.body.startDate;
      if (req.body.targetCompletionDate !== undefined) updates.target_completion_date = req.body.targetCompletionDate;
      if (req.body.responsibleUserId !== undefined) updates.responsible_user_id = req.body.responsibleUserId;

      // Validate custom fields if provided
      if (req.body.customFields) {
        const cfResult = await validateCustomFields(req.user!.organizationId, 'project', req.body.customFields);
        if (!cfResult.valid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
          return;
        }
        updates.custom_fields = cfResult.sanitized;
      }

      const project = await projectModel.updateProject(
        param(req.params.projectId),
        req.user!.organizationId,
        updates,
      );

      if (!project) {
        sendError(res, 404, 'NOT_FOUND', 'Project not found');
        return;
      }

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'project.updated',
        resourceType: 'project',
        resourceId: project.id,
        metadata: { updates: Object.keys(req.body) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { project });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/projects/:projectId — archive project
router.delete(
  '/:projectId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await projectModel.deleteProject(
        param(req.params.projectId),
        req.user!.organizationId,
      );

      if (!deleted) {
        sendError(res, 404, 'NOT_FOUND', 'Project not found');
        return;
      }

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'project.archived',
        resourceType: 'project',
        resourceId: param(req.params.projectId),
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Project archived' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/projects/:projectId/upload-url — request presigned URL for project image
router.post(
  '/:projectId/upload-url',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  uploadLimiter,
  validate(requestPhotoUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectModel.findProjectById(
        param(req.params.projectId),
        req.user!.organizationId,
      );

      if (!project) {
        sendError(res, 404, 'NOT_FOUND', 'Project not found');
        return;
      }

      const { fileName, fileSize, mimeType } = req.body;

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

      const imageId = randomUUID();
      const s3Key = storageService.buildS3Key(
        'project-images',
        req.user!.organizationId,
        project.id,
        imageId,
        fileName,
      );

      await projectModel.updateProject(project.id, req.user!.organizationId, {
        image_url: s3Key,
      });

      const presigned = await storageService.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
      );

      sendSuccess(res, {
        uploadUrl: presigned.uploadUrl,
        projectId: project.id,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/projects/:projectId/confirm-image — confirm image upload
router.post(
  '/:projectId/confirm-image',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectModel.findProjectById(
        param(req.params.projectId),
        req.user!.organizationId,
      );

      if (!project) {
        sendError(res, 404, 'NOT_FOUND', 'Project not found');
        return;
      }

      if (!project.image_url) {
        sendError(res, 400, 'NO_IMAGE', 'No image upload was requested');
        return;
      }

      const fileSize = await storageService.checkFileExists(project.image_url);
      if (fileSize === null) {
        sendError(res, 400, 'FILE_NOT_UPLOADED', 'File has not been uploaded yet');
        return;
      }

      let thumbnailKey: string | undefined;
      try {
        thumbnailKey = await thumbnailService.generateThumbnail(
          project.image_url,
          'photo',
        );
      } catch {
        // Thumbnail generation failure is non-fatal
      }

      await projectModel.updateProject(project.id, req.user!.organizationId, {
        thumbnail_url: thumbnailKey || null,
      });

      await storageTracking.incrementStorageUsed(
        req.user!.organizationId,
        fileSize,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'project.image_uploaded',
        resourceType: 'project',
        resourceId: project.id,
        metadata: { fileSize },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Image confirmed' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
