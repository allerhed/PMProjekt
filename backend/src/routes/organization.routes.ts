import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { updateOrganizationSchema } from '../validators/organization.validators';
import { requestPhotoUploadSchema } from '../validators/upload.validators';
import * as organizationModel from '../models/organization.model';
import * as storageService from '../services/storage.service';
import * as storageTracking from '../services/storageTracking.service';
import * as thumbnailService from '../services/thumbnail.service';

const router = Router();

// All organization routes require authentication
router.use(authenticate);

async function attachDownloadUrls(organization: organizationModel.OrganizationRow) {
  return {
    ...organization,
    logo_download_url: organization.logo_url
      ? await storageService.generatePresignedDownloadUrl(organization.logo_url)
      : null,
    logo_thumbnail_download_url: organization.logo_thumbnail_url
      ? await storageService.generatePresignedDownloadUrl(organization.logo_thumbnail_url)
      : null,
  };
}

// GET /api/v1/organizations/current — get current org details
router.get(
  '/current',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organization = await organizationModel.findOrganizationById(
        req.user!.organizationId,
      );

      if (!organization) {
        sendError(res, 404, 'NOT_FOUND', 'Organization not found');
        return;
      }

      sendSuccess(res, { organization: await attachDownloadUrls(organization) });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/current — update org settings
router.patch(
  '/current',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  validate(updateOrganizationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates: Partial<Pick<organizationModel.OrganizationRow, 'name' | 'primary_color'>> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.primaryColor !== undefined) updates.primary_color = req.body.primaryColor;

      const organization = await organizationModel.updateOrganization(
        req.user!.organizationId,
        updates,
      );

      if (!organization) {
        sendError(res, 404, 'NOT_FOUND', 'Organization not found');
        return;
      }

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'organization.updated',
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: { updates: Object.keys(req.body) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { organization: await attachDownloadUrls(organization) });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/current/upload-url — request presigned URL for logo
router.post(
  '/current/upload-url',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  uploadLimiter,
  validate(requestPhotoUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organization = await organizationModel.findOrganizationById(
        req.user!.organizationId,
      );

      if (!organization) {
        sendError(res, 404, 'NOT_FOUND', 'Organization not found');
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
        'org-logos',
        req.user!.organizationId,
        organization.id,
        imageId,
        fileName,
      );

      // Clean up old logo if replacing
      if (organization.logo_url) {
        try {
          const oldSize = await storageService.checkFileExists(organization.logo_url);
          await storageService.deleteObject(organization.logo_url);
          if (organization.logo_thumbnail_url) {
            await storageService.deleteObject(organization.logo_thumbnail_url);
          }
          if (oldSize) {
            await storageTracking.decrementStorageUsed(req.user!.organizationId, oldSize);
          }
        } catch {
          // Old logo cleanup failure is non-fatal
        }
      }

      await organizationModel.updateOrganization(organization.id, {
        logo_url: s3Key,
      });

      const presigned = await storageService.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
      );

      sendSuccess(res, {
        uploadUrl: presigned.uploadUrl,
        organizationId: organization.id,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/current/confirm-logo — confirm logo upload
router.post(
  '/current/confirm-logo',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organization = await organizationModel.findOrganizationById(
        req.user!.organizationId,
      );

      if (!organization) {
        sendError(res, 404, 'NOT_FOUND', 'Organization not found');
        return;
      }

      if (!organization.logo_url) {
        sendError(res, 400, 'NO_LOGO', 'No logo upload was requested');
        return;
      }

      const fileSize = await storageService.checkFileExists(organization.logo_url);
      if (fileSize === null) {
        sendError(res, 400, 'FILE_NOT_UPLOADED', 'File has not been uploaded yet');
        return;
      }

      let thumbnailKey: string | undefined;
      try {
        thumbnailKey = await thumbnailService.generateThumbnail(
          organization.logo_url,
          'photo',
        );
      } catch {
        // Thumbnail generation failure is non-fatal
      }

      await organizationModel.updateOrganization(organization.id, {
        logo_thumbnail_url: thumbnailKey || null,
      });

      await storageTracking.incrementStorageUsed(
        req.user!.organizationId,
        fileSize,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'organization.logo_uploaded',
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: { fileSize },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Logo confirmed' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
