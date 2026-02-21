import { Request, Response, NextFunction } from 'express';
import { verifyToken, generateToken, setAuthCookie, shouldRefreshToken } from '../utils/jwt';
import { findUserById } from '../models/user.model';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token;

    if (!token) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const decoded = verifyToken(token);

    // Fetch user to check if still active
    const user = await findUserById(decoded.userId);
    if (!user || !user.is_active) {
      sendError(res, 401, 'UNAUTHORIZED', 'Account is inactive or not found');
      return;
    }

    // Attach user to request (use fresh DB data, not stale JWT claims)
    req.user = {
      userId: user.id,
      organizationId: user.organization_id,
      role: user.role,
      email: user.email,
    };

    // Refresh token if past 50% lifetime (use fresh DB data)
    if (shouldRefreshToken(decoded.iat, decoded.exp)) {
      const newToken = generateToken({
        userId: user.id,
        organizationId: user.organization_id,
        role: user.role,
        email: user.email,
      });
      setAuthCookie(res, newToken);
    }

    next();
  } catch (err) {
    logger.debug({ err }, 'Authentication failed');
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}
