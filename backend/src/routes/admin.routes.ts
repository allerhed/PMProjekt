import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { sendSuccess } from '../utils/response';
import { UserRole } from '../types';
import pool from '../config/database';
import { getOrgStats, getRecentActivity } from '../services/stats.service';

const router = Router();
router.use(authenticate);

// GET /api/v1/admin/stats — org-level statistics
router.get(
  '/stats',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getOrgStats(req.user!.organizationId);
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/admin/activity — recent audit log activity
router.get(
  '/activity',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string, 10) || 50, 1),
        200,
      );
      const activity = await getRecentActivity(req.user!.organizationId, limit);
      sendSuccess(res, activity);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/admin/system/health — system health (super_admin only)
router.get(
  '/system/health',
  authorize(UserRole.SUPER_ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const dbResult = await pool.query('SELECT NOW() as time, version() as version');
      const memUsage = process.memoryUsage();

      sendSuccess(res, {
        database: {
          connected: true,
          time: dbResult.rows[0].time,
          version: dbResult.rows[0].version,
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
