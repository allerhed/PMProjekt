import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { updateOrganizationSchema } from '../validators/organization.validators';
import * as organizationModel from '../models/organization.model';

const router = Router();

// All organization routes require authentication
router.use(authenticate);

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

      sendSuccess(res, { organization });
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
      const updates: Partial<Pick<organizationModel.OrganizationRow, 'name' | 'logo_url' | 'primary_color'>> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.primaryColor !== undefined) updates.primary_color = req.body.primaryColor;
      if (req.body.logoUrl !== undefined) updates.logo_url = req.body.logoUrl;

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

      sendSuccess(res, { organization });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
