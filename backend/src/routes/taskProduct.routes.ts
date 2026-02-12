import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { addProductToTaskSchema } from '../validators/product.validators';
import * as productModel from '../models/product.model';
import * as taskModel from '../models/task.model';
import * as projectModel from '../models/project.model';
import * as storageService from '../services/storage.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authenticate);

// Helper: verify project and task access
async function verifyTaskAccess(req: Request, res: Response): Promise<boolean> {
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

// GET /api/v1/projects/:projectId/tasks/:taskId/products — list products linked to task
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyTaskAccess(req, res))) return;

    const taskProducts = await productModel.findProductsByTask(
      param(req.params.taskId),
      req.user!.organizationId,
    );

    // Generate download URLs for product images
    const productsWithUrls = await Promise.all(
      taskProducts.map(async (tp) => ({
        ...tp,
        image_download_url: tp.product_image_url
          ? await storageService.generatePresignedDownloadUrl(tp.product_image_url)
          : null,
        thumbnail_download_url: tp.product_thumbnail_url
          ? await storageService.generatePresignedDownloadUrl(tp.product_thumbnail_url)
          : null,
      })),
    );

    sendSuccess(res, { products: productsWithUrls });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/tasks/:taskId/products — add product to task
router.post(
  '/',
  validate(addProductToTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyTaskAccess(req, res))) return;

      // Verify product exists and belongs to the same organization
      const product = await productModel.findProductById(
        req.body.productId,
        req.user!.organizationId,
      );
      if (!product) {
        sendError(res, 404, 'NOT_FOUND', 'Product not found');
        return;
      }

      try {
        const taskProduct = await productModel.addProductToTask(
          param(req.params.taskId),
          req.body.productId,
          req.user!.userId,
        );

        logAuditAction({
          organizationId: req.user!.organizationId,
          userId: req.user!.userId,
          action: 'task.product_added',
          resourceType: 'task',
          resourceId: param(req.params.taskId),
          metadata: { productId: req.body.productId, productName: product.name },
          ipAddress: (req.ip as string || ''),
        });

        sendSuccess(res, { taskProduct }, 201);
      } catch (err: any) {
        if (err.code === '23505') {
          // Unique constraint violation — product already linked
          sendError(res, 409, 'ALREADY_EXISTS', 'Product is already linked to this task');
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/projects/:projectId/tasks/:taskId/products/:productId — remove product from task
router.delete(
  '/:productId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyTaskAccess(req, res))) return;

      const removed = await productModel.removeProductFromTask(
        param(req.params.taskId),
        param(req.params.productId),
      );

      if (!removed) {
        sendError(res, 404, 'NOT_FOUND', 'Product is not linked to this task');
        return;
      }

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'task.product_removed',
        resourceType: 'task',
        resourceId: param(req.params.taskId),
        metadata: { productId: param(req.params.productId) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Product removed from task' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
