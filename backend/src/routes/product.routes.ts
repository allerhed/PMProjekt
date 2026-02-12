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
import { createProductSchema, updateProductSchema } from '../validators/product.validators';
import { requestPhotoUploadSchema } from '../validators/upload.validators';
import * as productModel from '../models/product.model';
import * as storageService from '../services/storage.service';
import * as storageTracking from '../services/storageTracking.service';
import * as thumbnailService from '../services/thumbnail.service';
import { validateCustomFields } from '../services/customFieldValidation.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All product routes require authentication
router.use(authenticate);

// GET /api/v1/products — list products for the user's organization
router.get('/', parsePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const { products, total } = await productModel.findProductsByOrganization(
      req.user!.organizationId,
      { limit: req.pagination!.limit, offset: req.pagination!.offset },
      search,
    );

    // Generate download URLs for images
    const productsWithUrls = await Promise.all(
      products.map(async (product) => ({
        ...product,
        image_download_url: product.image_url
          ? await storageService.generatePresignedDownloadUrl(product.image_url)
          : null,
        thumbnail_download_url: product.thumbnail_url
          ? await storageService.generatePresignedDownloadUrl(product.thumbnail_url)
          : null,
      })),
    );

    sendSuccess(res, { products: productsWithUrls }, 200, {
      page: req.pagination!.page,
      limit: req.pagination!.limit,
      total,
      totalPages: Math.ceil(total / req.pagination!.limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products — create product
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate custom fields if provided
      let sanitizedCustomFields: Record<string, unknown> | undefined;
      if (req.body.customFields) {
        const cfResult = await validateCustomFields(req.user!.organizationId, 'product', req.body.customFields);
        if (!cfResult.valid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
          return;
        }
        sanitizedCustomFields = cfResult.sanitized;
      }

      const product = await productModel.createProduct({
        organizationId: req.user!.organizationId,
        productId: req.body.productId,
        name: req.body.name,
        description: req.body.description,
        link: req.body.link,
        comment: req.body.comment,
        customFields: sanitizedCustomFields,
        createdBy: req.user!.userId,
      });

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'product.created',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { name: product.name },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { product }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/products/:productId — get product detail
router.get('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productModel.findProductById(
      param(req.params.productId),
      req.user!.organizationId,
    );

    if (!product) {
      sendError(res, 404, 'NOT_FOUND', 'Product not found');
      return;
    }

    const productWithUrls = {
      ...product,
      image_download_url: product.image_url
        ? await storageService.generatePresignedDownloadUrl(product.image_url)
        : null,
      thumbnail_download_url: product.thumbnail_url
        ? await storageService.generatePresignedDownloadUrl(product.thumbnail_url)
        : null,
    };

    sendSuccess(res, { product: productWithUrls });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/products/:productId — update product
router.patch(
  '/:productId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await productModel.findProductById(
        param(req.params.productId),
        req.user!.organizationId,
      );

      if (!existing) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found');
        return;
      }

      // Validate custom fields if provided
      if (req.body.customFields) {
        const cfResult = await validateCustomFields(req.user!.organizationId, 'product', req.body.customFields);
        if (!cfResult.valid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
          return;
        }
        req.body.customFields = cfResult.sanitized;
      }

      const product = await productModel.updateProduct(param(req.params.productId), req.body);

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'product.updated',
        resourceType: 'product',
        resourceId: param(req.params.productId),
        metadata: {},
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { product });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/products/:productId — delete product
router.delete(
  '/:productId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productModel.findProductById(
        param(req.params.productId),
        req.user!.organizationId,
      );

      if (!product) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found');
        return;
      }

      // Delete product image from storage if exists
      if (product.image_url) {
        try {
          await storageService.deleteObject(product.image_url);
          if (product.thumbnail_url) {
            await storageService.deleteObject(product.thumbnail_url);
          }
        } catch {
          // Storage deletion failure is non-fatal
        }
      }

      await productModel.deleteProduct(param(req.params.productId));

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'product.deleted',
        resourceType: 'product',
        resourceId: param(req.params.productId),
        metadata: { name: product.name },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Product deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/products/:productId/upload-url — request presigned URL for product image
router.post(
  '/:productId/upload-url',
  uploadLimiter,
  validate(requestPhotoUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productModel.findProductById(
        param(req.params.productId),
        req.user!.organizationId,
      );

      if (!product) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found');
        return;
      }

      const { fileName, fileSize, mimeType } = req.body;

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

      const imageId = randomUUID();
      const s3Key = storageService.buildS3Key(
        'product-images',
        req.user!.organizationId,
        product.id,
        imageId,
        fileName,
      );

      // Update product with the S3 key (will be confirmed later)
      await productModel.updateProduct(product.id, { imageUrl: s3Key });

      const presigned = await storageService.generatePresignedUploadUrl(
        s3Key,
        mimeType,
        fileSize,
      );

      sendSuccess(res, {
        uploadUrl: presigned.uploadUrl,
        productId: product.id,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/products/:productId/confirm-image — confirm image upload
router.post(
  '/:productId/confirm-image',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productModel.findProductById(
        param(req.params.productId),
        req.user!.organizationId,
      );

      if (!product) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found');
        return;
      }

      if (!product.image_url) {
        sendError(res, 400, 'NO_IMAGE', 'No image upload was requested');
        return;
      }

      // Verify file exists
      const fileSize = await storageService.checkFileExists(product.image_url);
      if (fileSize === null) {
        sendError(res, 400, 'FILE_NOT_UPLOADED', 'File has not been uploaded yet');
        return;
      }

      // Generate thumbnail
      let thumbnailKey: string | undefined;
      try {
        thumbnailKey = await thumbnailService.generateThumbnail(
          product.image_url,
          'photo',
        );
      } catch {
        // Thumbnail generation failure is non-fatal
      }

      // Update product with thumbnail
      const updated = await productModel.updateProduct(product.id, {
        thumbnailUrl: thumbnailKey || null,
      });

      // Track storage usage
      await storageTracking.incrementStorageUsed(
        req.user!.organizationId,
        fileSize,
      );

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'product.image_uploaded',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { fileSize },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { product: updated });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
