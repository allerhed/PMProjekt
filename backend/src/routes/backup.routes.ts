import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { backupLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { logAuditAction } from '../services/audit.service';
import { UserRole } from '../types';
import { createBackupSchema, updateBackupSettingsSchema, restoreBackupSchema } from '../validators/backup.validators';
import * as backupModel from '../models/backup.model';
import * as backupService from '../services/backup.service';
import { param } from '../utils/params';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN));

// GET /settings — must be before /:backupId
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await backupModel.getBackupSettings(req.user!.organizationId);
    sendSuccess(res, {
      settings: settings || {
        schedule_enabled: false,
        schedule_cron: '0 3 * * *',
        retention_days: 30,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /settings
router.put('/settings', validate(updateBackupSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await backupModel.upsertBackupSettings({
      organizationId: req.user!.organizationId,
      scheduleEnabled: req.body.scheduleEnabled,
      scheduleCron: req.body.scheduleCron,
      retentionDays: req.body.retentionDays,
      updatedBy: req.user!.userId,
    });

    backupService.updateSchedule(
      req.user!.organizationId,
      settings.schedule_enabled,
      settings.schedule_cron,
    );

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'backup.settings_updated',
      resourceType: 'backup_settings',
      metadata: {
        scheduleEnabled: settings.schedule_enabled,
        scheduleCron: settings.schedule_cron,
        retentionDays: settings.retention_days,
      },
      ipAddress: req.ip as string || '',
    });

    sendSuccess(res, { settings });
  } catch (err) {
    next(err);
  }
});

// GET / — list backups
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = await backupModel.findBackupsByOrganization(req.user!.organizationId);
    sendSuccess(res, { backups });
  } catch (err) {
    next(err);
  }
});

// POST / — trigger backup
router.post('/', backupLimiter, validate(createBackupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backupId = await backupService.startBackup({
      organizationId: req.user!.organizationId,
      name: req.body.name,
      triggeredBy: 'manual',
      initiatedBy: req.user!.userId,
      ipAddress: req.ip as string || '',
    });

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'backup.created',
      resourceType: 'backup',
      resourceId: backupId,
      metadata: { name: req.body.name },
      ipAddress: req.ip as string || '',
    });

    sendSuccess(res, { backupId, status: 'in_progress' }, 202);
  } catch (err: any) {
    if (err.statusCode === 409) {
      sendError(res, 409, 'BACKUP_IN_PROGRESS', err.message);
      return;
    }
    next(err);
  }
});

// GET /:backupId
router.get('/:backupId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = await backupModel.findBackupById(
      param(req.params.backupId),
      req.user!.organizationId,
    );
    if (!backup) {
      sendError(res, 404, 'NOT_FOUND', 'Backup not found');
      return;
    }
    sendSuccess(res, { backup });
  } catch (err) {
    next(err);
  }
});

// GET /:backupId/download
router.get('/:backupId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const downloadUrl = await backupService.getBackupDownloadUrl(
      param(req.params.backupId),
      req.user!.organizationId,
    );
    sendSuccess(res, { downloadUrl });
  } catch (err: any) {
    if (err.statusCode === 404) {
      sendError(res, 404, 'NOT_FOUND', err.message);
      return;
    }
    next(err);
  }
});

// DELETE /:backupId
router.delete('/:backupId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await backupService.deleteBackupWithFile(
      param(req.params.backupId),
      req.user!.organizationId,
    );

    logAuditAction({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      action: 'backup.deleted',
      resourceType: 'backup',
      resourceId: param(req.params.backupId),
      ipAddress: req.ip as string || '',
    });

    sendSuccess(res, { message: 'Backup deleted' });
  } catch (err: any) {
    if (err.statusCode === 404) {
      sendError(res, 404, 'NOT_FOUND', err.message);
      return;
    }
    next(err);
  }
});

// POST /:backupId/restore — super_admin only
router.post(
  '/:backupId/restore',
  authorize(UserRole.SUPER_ADMIN),
  validate(restoreBackupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await backupService.restoreFromBackup(
        param(req.params.backupId),
        req.user!.organizationId,
        req.user!.userId,
        req.ip as string || '',
      );
      sendSuccess(res, { message: 'Database restored successfully' });
    } catch (err: any) {
      if (err.statusCode === 404) {
        sendError(res, 404, 'NOT_FOUND', err.message);
        return;
      }
      next(err);
    }
  },
);

export default router;
