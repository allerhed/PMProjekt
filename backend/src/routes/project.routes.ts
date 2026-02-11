import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validators';
import * as projectModel from '../models/project.model';
import { param } from '../utils/params';

const router = Router();

// All project routes require authentication
router.use(authenticate);

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

    sendSuccess(res, { projects }, 200, {
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
      const project = await projectModel.createProject({
        organizationId: req.user!.organizationId,
        name: req.body.name,
        description: req.body.description,
        address: req.body.address,
        startDate: req.body.startDate,
        targetCompletionDate: req.body.targetCompletionDate,
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

    sendSuccess(res, { project });
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

export default router;
