import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateQuery } from '../middleware/validate';
import { sendSuccess } from '../utils/response';
import { UserRole } from '../types';
import { taskReportQuerySchema } from '../validators/report.validators';
import { findTasksForReport } from '../models/report.model';

const router = Router();
router.use(authenticate);

// GET /api/v1/admin/reports/tasks — task report with date range and filters
router.get(
  '/tasks',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  validateQuery(taskReportQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, projectId, userId } = req.query as {
        startDate: string;
        endDate: string;
        projectId?: string;
        userId?: string;
      };

      const tasks = await findTasksForReport(req.user!.organizationId, {
        startDate,
        endDate,
        projectId,
        userId,
      });

      sendSuccess(res, { tasks, count: tasks.length });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
