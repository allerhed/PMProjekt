import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { hashPassword, comparePassword, validatePasswordPolicy } from '../utils/password';
import * as userModel from '../models/user.model';
import { validateCustomFields } from '../services/customFieldValidation.service';
import { z } from 'zod';
import { param } from '../utils/params';

const router = Router();
router.use(authenticate);

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['org_admin', 'project_manager', 'field_user']),
  password: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(8).optional(),
  ),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['org_admin', 'project_manager', 'field_user']).optional(),
  isActive: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/v1/users — list users in org
router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  parsePagination,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { users, total } = await userModel.findUsersByOrganization(
        req.user!.organizationId,
        {
          role: req.query.role as UserRole,
          isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
          page: req.pagination!.page,
          limit: req.pagination!.limit,
        },
      );

      // Remove password hashes from response
      const sanitized = users.map(({ password_hash, ...u }) => u);

      sendSuccess(res, { users: sanitized }, 200, {
        page: req.pagination!.page,
        limit: req.pagination!.limit,
        total,
        totalPages: Math.ceil(total / req.pagination!.limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/users — create (invite) user
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check email uniqueness
      const existing = await userModel.findUserByEmail(req.body.email);
      if (existing) {
        sendError(res, 409, 'CONFLICT', 'Email is already registered');
        return;
      }

      // Use admin-provided password or generate a temporary one
      const passwordToHash = req.body.password || `Temp${Date.now()}!`;
      const policyError = validatePasswordPolicy(passwordToHash, req.body.email);
      if (policyError) {
        sendError(res, 400, 'VALIDATION_ERROR', policyError);
        return;
      }
      const passwordHash = await hashPassword(passwordToHash);

      // Validate custom fields if provided
      let sanitizedCustomFields: Record<string, unknown> | undefined;
      if (req.body.customFields) {
        const cfResult = await validateCustomFields(req.user!.organizationId, 'user', req.body.customFields);
        if (!cfResult.valid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
          return;
        }
        sanitizedCustomFields = cfResult.sanitized;
      }

      const user = await userModel.createUser({
        organizationId: req.user!.organizationId,
        email: req.body.email,
        passwordHash,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role as UserRole,
        customFields: sanitizedCustomFields,
      });

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'user.created',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: (req.ip as string || ''),
      });

      // TODO: Send invitation email (Phase 5)

      const { password_hash, ...sanitized } = user;
      sendSuccess(res, { user: sanitized }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/users/:userId
router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userModel.findUserById(param(req.params.userId));

    if (!user) {
      sendError(res, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    // Org scoping: non-super_admin can only see users in their org
    if (req.user!.role !== UserRole.SUPER_ADMIN && user.organization_id !== req.user!.organizationId) {
      sendError(res, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    const { password_hash, ...sanitized } = user;
    sendSuccess(res, { user: sanitized });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:userId
router.patch('/:userId', validate(updateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUser = await userModel.findUserById(param(req.params.userId));

    if (!targetUser) {
      sendError(res, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    // Only admins can edit other users, users can edit their own profile
    const isSelf = param(req.params.userId) === req.user!.userId;
    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(req.user!.role);

    if (!isSelf && !isAdmin) {
      sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
      return;
    }

    // Non-admin editing self cannot change role or isActive
    if (isSelf && !isAdmin) {
      delete req.body.role;
      delete req.body.isActive;
    }

    // Only self can change own password with currentPassword; admins can set password for others
    if (!isSelf) {
      delete req.body.currentPassword;
    }

    // Org scoping
    if (req.user!.role !== UserRole.SUPER_ADMIN && targetUser.organization_id !== req.user!.organizationId) {
      sendError(res, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.firstName) updates.first_name = req.body.firstName;
    if (req.body.lastName) updates.last_name = req.body.lastName;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;

    // Handle email change
    if (req.body.email && req.body.email !== targetUser.email) {
      const existing = await userModel.findUserByEmail(req.body.email);
      if (existing) {
        sendError(res, 409, 'CONFLICT', 'Email is already registered');
        return;
      }
      updates.email = req.body.email;
    }

    // Handle password change
    if (req.body.newPassword) {
      if (isSelf) {
        // Self-edit: require current password
        if (!req.body.currentPassword) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Current password is required to change password');
          return;
        }

        const isValid = await comparePassword(req.body.currentPassword, targetUser.password_hash);
        if (!isValid) {
          sendError(res, 400, 'VALIDATION_ERROR', 'Current password is incorrect');
          return;
        }
      }

      // Both self and admin: validate policy
      const policyError = validatePasswordPolicy(req.body.newPassword, targetUser.email);
      if (policyError) {
        sendError(res, 400, 'VALIDATION_ERROR', policyError);
        return;
      }

      updates.password_hash = await hashPassword(req.body.newPassword);
    }

    // Validate custom fields if provided
    if (req.body.customFields) {
      const cfResult = await validateCustomFields(req.user!.organizationId, 'user', req.body.customFields);
      if (!cfResult.valid) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Custom field validation failed', { customFieldErrors: cfResult.errors });
        return;
      }
      updates.custom_fields = cfResult.sanitized;
    }

    const updated = await userModel.updateUser(param(req.params.userId), updates);

    if (!updated) {
      sendError(res, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    const { password_hash, ...sanitized } = updated;
    sendSuccess(res, { user: sanitized });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/:userId — deactivate
router.delete(
  '/:userId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Prevent self-deactivation
      if (param(req.params.userId) === req.user!.userId) {
        sendError(res, 400, 'BAD_REQUEST', 'Cannot deactivate your own account');
        return;
      }

      const user = await userModel.findUserById(param(req.params.userId));
      if (!user || (req.user!.role !== UserRole.SUPER_ADMIN && user.organization_id !== req.user!.organizationId)) {
        sendError(res, 404, 'NOT_FOUND', 'User not found');
        return;
      }

      await userModel.updateUser(param(req.params.userId), { is_active: false });

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'user.deactivated',
        resourceType: 'user',
        resourceId: param(req.params.userId),
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { message: 'User deactivated' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
