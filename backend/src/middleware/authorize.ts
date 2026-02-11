import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { sendError } from '../utils/response';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
      return;
    }

    next();
  };
}

/**
 * Ensures user can only access resources in their own organization.
 * super_admin bypasses this check.
 */
export function enforceOrgScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  // super_admin can access all orgs
  if (req.user.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Check org ID from params or body
  const orgId = req.params.orgId || req.body?.organizationId;
  if (orgId && orgId !== req.user.organizationId) {
    sendError(res, 403, 'FORBIDDEN', 'Access denied to this organization');
    return;
  }

  next();
}
