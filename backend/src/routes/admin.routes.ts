import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { sendSuccess } from '../utils/response';
import { UserRole } from '../types';
import pool from '../config/database';
import config from '../config';
import { getOrgStats, getRecentActivity, getUserActivity } from '../services/stats.service';

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

// GET /api/v1/admin/users/activity — per-user activity report
router.get(
  '/users/activity',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const activity = await getUserActivity(req.user!.organizationId, startDate, endDate);
      sendSuccess(res, { users: activity });
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
      const [dbResult, activeUsersResult] = await Promise.all([
        pool.query('SELECT NOW() as time, version() as version'),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours' AND is_active = true`,
        ),
      ]);

      const memUsage = process.memoryUsage();

      // Storage health check
      let storageConnected = false;
      let storageResponseTimeMs = 0;
      const storageStart = Date.now();
      try {
        if (config.storage.provider === 'azure') {
          const { BlobServiceClient } = await import('@azure/storage-blob');
          const blobServiceClient = BlobServiceClient.fromConnectionString(
            config.azure.storage.connectionString,
          );
          const containerClient = blobServiceClient.getContainerClient(config.azure.storage.container);
          await containerClient.getProperties();
          storageConnected = true;
        } else {
          const fs = await import('fs');
          await fs.promises.access(config.storage.localPath);
          storageConnected = true;
        }
      } catch {
        storageConnected = false;
      }
      storageResponseTimeMs = Date.now() - storageStart;

      sendSuccess(res, {
        database: {
          connected: true,
          time: dbResult.rows[0].time,
          version: dbResult.rows[0].version,
        },
        storage: {
          connected: storageConnected,
          responseTimeMs: storageResponseTimeMs,
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
        activeUsers: activeUsersResult.rows[0].count,
        uptime: Math.round(process.uptime()),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
