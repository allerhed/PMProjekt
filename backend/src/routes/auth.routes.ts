import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { setAuthCookie, clearAuthCookie } from '../utils/jwt';
import { sendSuccess } from '../utils/response';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';
import * as authService from '../services/auth.service';
import { logAuditAction } from '../services/audit.service';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token);
    sendSuccess(res, {
      user: result.user,
      organization: result.organization,
    }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    setAuthCookie(res, result.token);

    logAuditAction({
      organizationId: result.user.organization_id,
      userId: result.user.id,
      action: 'user.login',
      ipAddress: (req.ip as string || ''),
    });

    sendSuccess(res, { user: result.user });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  sendSuccess(res, { message: 'Logged out successfully' });
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    // Always return success to prevent email enumeration
    sendSuccess(res, { message: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    sendSuccess(res, { message: 'Password has been reset successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh — requires valid JWT
router.post('/refresh', authenticate, (req: Request, res: Response) => {
  // Token refresh already handled by authenticate middleware
  // Just confirm success
  sendSuccess(res, { message: 'Token refreshed' });
});

// GET /api/v1/auth/me — requires valid JWT
router.get('/me', authenticate, (req: Request, res: Response) => {
  sendSuccess(res, { user: req.user });
});

export default router;
