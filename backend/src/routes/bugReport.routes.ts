import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { createBugReportSchema, updateBugReportSchema } from '../validators/bugReport.validators';
import * as bugReportModel from '../models/bugReport.model';
import * as storageService from '../services/storage.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/v1/bug-reports — list bug reports
router.get('/', parsePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      search: req.query.search as string | undefined,
    };

    const { bugReports, total } = await bugReportModel.findBugReportsByOrganization(
      req.user!.organizationId,
      { limit: req.pagination!.limit, offset: req.pagination!.offset },
      filters,
    );

    const reportsWithUrls = await Promise.all(
      bugReports.map(async (report) => ({
        ...report,
        screenshot_download_url: report.screenshot_url
          ? await storageService.generatePresignedDownloadUrl(report.screenshot_url)
          : null,
      })),
    );

    sendSuccess(res, { bugReports: reportsWithUrls }, 200, {
      page: req.pagination!.page,
      limit: req.pagination!.limit,
      total,
      totalPages: Math.ceil(total / req.pagination!.limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bug-reports/count — count open bug reports
router.get('/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await bugReportModel.countOpenBugReports(req.user!.organizationId);
    sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bug-reports/:reportId — get bug report detail
router.get('/:reportId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await bugReportModel.findBugReportById(
      param(req.params.reportId),
      req.user!.organizationId,
    );

    if (!report) {
      sendError(res, 404, 'NOT_FOUND', 'Bug report not found');
      return;
    }

    const reportWithUrl = {
      ...report,
      screenshot_download_url: report.screenshot_url
        ? await storageService.generatePresignedDownloadUrl(report.screenshot_url)
        : null,
    };

    sendSuccess(res, { bugReport: reportWithUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bug-reports — create bug report
router.post('/', validate(createBugReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportNumber = await bugReportModel.getNextReportNumber(req.user!.organizationId);

    let screenshotUrl: string | undefined;
    if (req.body.screenshotBase64) {
      const base64Data = req.body.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const key = storageService.buildS3Key(
        'bug-screenshots',
        req.user!.organizationId,
        'reports',
        String(reportNumber),
        `screenshot-${Date.now()}.png`,
      );
      await storageService.writeFile(key, buffer, 'image/png');
      screenshotUrl = key;
    }

    const report = await bugReportModel.createBugReport({
      organizationId: req.user!.organizationId,
      reportNumber,
      title: req.body.title,
      description: req.body.description,
      stepsToReproduce: req.body.stepsToReproduce,
      priority: req.body.priority,
      screenshotUrl,
      consoleLogs: req.body.consoleLogs,
      metadata: req.body.metadata,
      reportedBy: req.user!.userId,
    });

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'bug_report.created',
      resourceType: 'bug_report',
      resourceId: report.id,
      metadata: { title: report.title, reportNumber },
      ipAddress: req.ip as string || '',
    });

    sendSuccess(res, { bugReport: report }, 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/bug-reports/:reportId — update bug report
router.patch(
  '/:reportId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(updateBugReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await bugReportModel.findBugReportById(
        param(req.params.reportId),
        req.user!.organizationId,
      );

      if (!existing) {
        sendError(res, 404, 'NOT_FOUND', 'Bug report not found');
        return;
      }

      const updateData = { ...req.body };
      if (updateData.status === 'resolved' && existing.status !== 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
      }
      if (updateData.status && updateData.status !== 'resolved' && updateData.status !== 'closed') {
        updateData.resolvedAt = null;
      }

      const report = await bugReportModel.updateBugReport(param(req.params.reportId), updateData);

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'bug_report.updated',
        resourceType: 'bug_report',
        resourceId: param(req.params.reportId),
        metadata: { changes: Object.keys(req.body) },
        ipAddress: req.ip as string || '',
      });

      sendSuccess(res, { bugReport: report });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/bug-reports/:reportId — delete bug report
router.delete(
  '/:reportId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await bugReportModel.findBugReportById(
        param(req.params.reportId),
        req.user!.organizationId,
      );

      if (!report) {
        sendError(res, 404, 'NOT_FOUND', 'Bug report not found');
        return;
      }

      if (report.screenshot_url) {
        try {
          await storageService.deleteObject(report.screenshot_url);
        } catch {
          // Storage deletion failure is non-fatal
        }
      }

      await bugReportModel.deleteBugReport(param(req.params.reportId));

      logAuditAction({
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        action: 'bug_report.deleted',
        resourceType: 'bug_report',
        resourceId: param(req.params.reportId),
        metadata: { title: report.title },
        ipAddress: req.ip as string || '',
      });

      sendSuccess(res, { message: 'Bug report deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
