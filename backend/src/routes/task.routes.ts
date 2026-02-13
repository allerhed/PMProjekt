import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { createTaskSchema, updateTaskSchema } from '../validators/task.validators';
import * as taskModel from '../models/task.model';
import * as projectModel from '../models/project.model';
import { validateCustomFields } from '../services/customFieldValidation.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All task routes require authentication
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

// GET /api/v1/projects/:projectId/tasks/by-blueprint/:blueprintId — tasks linked to a blueprint
router.get('/by-blueprint/:blueprintId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;

    const tasks = await taskModel.findTasksByBlueprint(
      param(req.params.blueprintId),
      req.user!.organizationId,
    );

    sendSuccess(res, { tasks });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:projectId/tasks — list tasks with filtering
router.get('/', parsePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;

    const filters: taskModel.TaskFilters = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.trade) filters.trade = req.query.trade as string;
    if (req.query.assignedToMe === 'true') filters.assignedToUser = req.user!.userId;
    if (req.query.search) filters.search = req.query.search as string;

    const sortBy = req.query.sortBy as string | undefined;
    if (sortBy && ['number', 'date', 'user'].includes(sortBy)) {
      filters.sortBy = sortBy as 'number' | 'date' | 'user';
    }
    const sortOrder = req.query.sortOrder as string | undefined;
    if (sortOrder && ['asc', 'desc'].includes(sortOrder)) {
      filters.sortOrder = sortOrder as 'asc' | 'desc';
    }

    const { tasks, total } = await taskModel.findTasksByProject(
      param(req.params.projectId),
      req.user!.organizationId,
      filters,
      { limit: req.pagination!.limit, offset: req.pagination!.offset },
    );

    sendSuccess(res, { tasks }, 200, {
      page: req.pagination!.page,
      limit: req.pagination!.limit,
      total,
      totalPages: Math.ceil(total / req.pagination!.limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/tasks — create task
router.post('/', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;

    // Validate custom fields if provided
    let sanitizedCustomFields: Record<string, unknown> | undefined;
    if (req.body.customFields) {
      const cfResult = await validateCustomFields(req.user!.organizationId, 'task', req.body.customFields);
      if (!cfResult.valid) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
        return;
      }
      sanitizedCustomFields = cfResult.sanitized;
    }

    const task = await taskModel.createTask({
      projectId: param(req.params.projectId),
      blueprintId: req.body.blueprintId,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      trade: req.body.trade,
      locationX: req.body.locationX,
      locationY: req.body.locationY,
      assignedToUser: req.body.assignedToUser,
      assignedToContractorEmail: req.body.assignedToContractorEmail,
      customFields: sanitizedCustomFields,
      createdBy: req.user!.userId,
    });

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'task.created',
      resourceType: 'task',
      resourceId: task.id,
      metadata: { projectId: param(req.params.projectId), trade: task.trade },
      ipAddress: (req.ip as string || ''),
    });

    sendSuccess(res, { task }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:projectId/tasks/:taskId — get task detail
router.get('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskModel.findTaskById(param(req.params.taskId), req.user!.organizationId);

    if (!task || task.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Task not found');
      return;
    }

    sendSuccess(res, { task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/projects/:projectId/tasks/:taskId — update task
router.patch('/:taskId', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existingTask = await taskModel.findTaskById(param(req.params.taskId), req.user!.organizationId);

    if (!existingTask || existingTask.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Task not found');
      return;
    }

    // Check field_user can only update tasks assigned to them
    if (req.user!.role === UserRole.FIELD_USER) {
      if (existingTask.assigned_to_user !== req.user!.userId && existingTask.created_by !== req.user!.userId) {
        sendError(res, 403, 'FORBIDDEN', 'You can only update tasks assigned to or created by you');
        return;
      }
    }

    // Validate status transition
    if (req.body.status && req.body.status !== existingTask.status) {
      if (!taskModel.isValidStatusTransition(existingTask.status, req.body.status)) {
        sendError(res, 400, 'INVALID_TRANSITION', `Cannot transition from '${existingTask.status}' to '${req.body.status}'`);
        return;
      }

      // Set timestamps on status changes
      if (req.body.status === 'completed') {
        req.body.completedAt = new Date().toISOString();
      } else if (req.body.status === 'verified') {
        req.body.verifiedAt = new Date().toISOString();
      }
    }

    // Validate custom fields if provided
    if (req.body.customFields) {
      const cfResult = await validateCustomFields(req.user!.organizationId, 'task', req.body.customFields);
      if (!cfResult.valid) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
        return;
      }
      req.body.customFields = cfResult.sanitized;
    }

    const task = await taskModel.updateTask(param(req.params.taskId), req.body);

    if (!task) {
      sendError(res, 404, 'NOT_FOUND', 'Task not found');
      return;
    }

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: req.body.status ? 'task.status_changed' : 'task.updated',
      resourceType: 'task',
      resourceId: task.id,
      metadata: {
        projectId: param(req.params.projectId),
        ...(req.body.status ? { from: existingTask.status, to: req.body.status } : {}),
      },
      ipAddress: (req.ip as string || ''),
    });

    sendSuccess(res, { task });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:projectId/tasks/:taskId — delete task
router.delete(
  '/:taskId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await taskModel.findTaskById(param(req.params.taskId), req.user!.organizationId);

      if (!task || task.project_id !== param(req.params.projectId)) {
        sendError(res, 404, 'NOT_FOUND', 'Task not found');
        return;
      }

      await taskModel.deleteTask(param(req.params.taskId));

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'task.deleted',
        resourceType: 'task',
        resourceId: param(req.params.taskId),
        metadata: { projectId: param(req.params.projectId) },
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'Task deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
