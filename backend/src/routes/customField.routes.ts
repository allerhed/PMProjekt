import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderCustomFieldsSchema,
} from '../validators/customField.validators';
import * as customFieldModel from '../models/customField.model';
import { param } from '../utils/params';

// Admin router — full CRUD, restricted to admins
export const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN));

// GET /api/v1/admin/custom-fields?entityType=project
adminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.query.entityType as string;
    if (!entityType) {
      sendError(res, 400, 'VALIDATION_ERROR', 'entityType query parameter is required');
      return;
    }

    const includeInactive = req.query.includeInactive === 'true';
    const definitions = await customFieldModel.findByOrganizationAndEntity(
      req.user!.organizationId,
      entityType,
      includeInactive,
    );

    sendSuccess(res, { definitions });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/custom-fields
adminRouter.post(
  '/',
  validate(createCustomFieldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let fieldKey = customFieldModel.generateFieldKey(req.body.label);

      // Check for uniqueness, append suffix if needed
      const existing = await customFieldModel.findByOrganizationAndEntity(
        req.user!.organizationId,
        req.body.entityType,
        true,
      );
      const existingKeys = new Set(existing.map((d) => d.field_key));

      if (existingKeys.has(fieldKey)) {
        let suffix = 2;
        while (existingKeys.has(`${fieldKey}_${suffix}`)) suffix++;
        fieldKey = `${fieldKey}_${suffix}`;
      }

      const definition = await customFieldModel.create({
        organizationId: req.user!.organizationId,
        entityType: req.body.entityType,
        fieldKey,
        label: req.body.label,
        fieldType: req.body.fieldType,
        options: req.body.options,
        isRequired: req.body.isRequired,
        displayOrder: req.body.displayOrder,
      });

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'custom_field.created',
        resourceType: 'custom_field_definition',
        resourceId: definition.id,
        metadata: { entityType: req.body.entityType, label: req.body.label },
        ipAddress: (req.ip as string) || '',
      });

      sendSuccess(res, { definition }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/admin/custom-fields/:fieldId
adminRouter.get('/:fieldId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const definition = await customFieldModel.findById(
      param(req.params.fieldId),
      req.user!.organizationId,
    );

    if (!definition) {
      sendError(res, 404, 'NOT_FOUND', 'Custom field definition not found');
      return;
    }

    sendSuccess(res, { definition });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/custom-fields/:fieldId
adminRouter.patch(
  '/:fieldId',
  validate(updateCustomFieldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const definition = await customFieldModel.update(
        param(req.params.fieldId),
        req.user!.organizationId,
        req.body,
      );

      if (!definition) {
        sendError(res, 404, 'NOT_FOUND', 'Custom field definition not found');
        return;
      }

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'custom_field.updated',
        resourceType: 'custom_field_definition',
        resourceId: definition.id,
        metadata: { updates: Object.keys(req.body) },
        ipAddress: (req.ip as string) || '',
      });

      sendSuccess(res, { definition });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/admin/custom-fields/:fieldId — soft delete
adminRouter.delete('/:fieldId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const definition = await customFieldModel.deactivate(
      param(req.params.fieldId),
      req.user!.organizationId,
    );

    if (!definition) {
      sendError(res, 404, 'NOT_FOUND', 'Custom field definition not found');
      return;
    }

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'custom_field.deactivated',
      resourceType: 'custom_field_definition',
      resourceId: definition.id,
      metadata: { label: definition.label },
      ipAddress: (req.ip as string) || '',
    });

    sendSuccess(res, { message: 'Field deactivated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/admin/custom-fields/reorder
adminRouter.put(
  '/reorder',
  validate(reorderCustomFieldsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await customFieldModel.reorder(
        req.user!.organizationId,
        req.body.entityType,
        req.body.orderedIds,
      );

      sendSuccess(res, { message: 'Fields reordered' });
    } catch (err) {
      next(err);
    }
  },
);

// Public router — active definitions only, any authenticated user
export const publicRouter = Router();
publicRouter.use(authenticate);

// GET /api/v1/custom-fields?entityType=project
publicRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.query.entityType as string;
    if (!entityType) {
      sendError(res, 400, 'VALIDATION_ERROR', 'entityType query parameter is required');
      return;
    }

    const definitions = await customFieldModel.findByOrganizationAndEntity(
      req.user!.organizationId,
      entityType,
    );

    sendSuccess(res, { definitions });
  } catch (err) {
    next(err);
  }
});
