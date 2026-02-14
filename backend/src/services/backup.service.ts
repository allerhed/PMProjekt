import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import cron, { ScheduledTask } from 'node-cron';
import { containerClient } from '../config/azure-storage';
import config from '../config';
import { logger } from '../utils/logger';
import * as backupModel from '../models/backup.model';
import { buildS3Key, generatePresignedDownloadUrl, deleteObject, readFile } from './storage.service';
import { logAuditAction } from './audit.service';

const scheduledJobs = new Map<string, ScheduledTask>();

export interface BackupParams {
  organizationId: string;
  name: string;
  triggeredBy: 'manual' | 'scheduled';
  initiatedBy?: string;
  ipAddress?: string;
}

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  };
}

export async function startBackup(params: BackupParams): Promise<string> {
  const inProgress = await backupModel.hasInProgressBackup(params.organizationId);
  if (inProgress) {
    throw Object.assign(new Error('A backup is already in progress'), { statusCode: 409 });
  }

  const backup = await backupModel.createBackup({
    organizationId: params.organizationId,
    name: params.name,
    triggeredBy: params.triggeredBy,
    initiatedBy: params.initiatedBy,
  });

  setImmediate(async () => {
    try {
      const db = parseDatabaseUrl(config.db.url);
      const s3Key = buildS3Key(
        'backups',
        params.organizationId,
        backup.id,
        backup.id,
        `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`,
      );

      const dumpProcess = spawn('pg_dump', [
        '-Fc', '-Z', '6',
        '--no-owner', '--no-acl',
        '-h', db.host,
        '-p', db.port,
        '-U', db.user,
        db.database,
      ], {
        env: { ...process.env, PGPASSWORD: db.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrData = '';
      dumpProcess.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      const passthrough = new PassThrough();
      dumpProcess.stdout.pipe(passthrough);

      const blockBlobClient = containerClient.getBlockBlobClient(s3Key);

      const uploadPromise = blockBlobClient.uploadStream(
        passthrough,
        4 * 1024 * 1024, // 4MB buffer size
        5,               // max concurrency
        {
          blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
        },
      );

      const processPromise = new Promise<void>((resolve, reject) => {
        dumpProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`pg_dump exited with code ${code}: ${stderrData}`));
          } else {
            resolve();
          }
        });
        dumpProcess.on('error', reject);
      });

      await processPromise;
      await uploadPromise;

      // Get actual file size from blob properties
      let finalSize = 0;
      try {
        const properties = await blockBlobClient.getProperties();
        finalSize = properties.contentLength || 0;
      } catch {
        finalSize = 0;
      }

      await backupModel.updateBackupCompleted(backup.id, s3Key, finalSize);

      logAuditAction({
        organizationId: params.organizationId,
        userId: params.initiatedBy || null,
        action: 'backup.completed',
        resourceType: 'backup',
        resourceId: backup.id,
        metadata: { name: params.name, fileSizeBytes: finalSize },
        ipAddress: params.ipAddress,
      });

      logger.info({ backupId: backup.id, s3Key, fileSize: finalSize }, 'Backup completed');

      // Cleanup expired backups
      await cleanupExpiredBackups(params.organizationId);
    } catch (err) {
      logger.error({ err, backupId: backup.id }, 'Backup failed');
      await backupModel.updateBackupFailed(backup.id, (err as Error).message);
    }
  });

  return backup.id;
}

export async function getBackupDownloadUrl(backupId: string, organizationId: string): Promise<string> {
  const backup = await backupModel.findBackupById(backupId, organizationId);
  if (!backup || backup.status !== 'completed' || !backup.file_key) {
    throw Object.assign(new Error('Backup not available for download'), { statusCode: 404 });
  }
  return generatePresignedDownloadUrl(backup.file_key);
}

export async function restoreFromBackup(
  backupId: string,
  organizationId: string,
  userId: string,
  ipAddress?: string,
): Promise<void> {
  const backup = await backupModel.findBackupById(backupId, organizationId);
  if (!backup || backup.status !== 'completed' || !backup.file_key) {
    throw Object.assign(new Error('Backup not available for restore'), { statusCode: 404 });
  }

  const db = parseDatabaseUrl(config.db.url);
  const backupData = await readFile(backup.file_key);

  const restoreProcess = spawn('pg_restore', [
    '--clean', '--if-exists',
    '--no-owner', '--no-acl',
    '-h', db.host,
    '-p', db.port,
    '-U', db.user,
    '-d', db.database,
  ], {
    env: { ...process.env, PGPASSWORD: db.password },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  restoreProcess.stdin.write(backupData);
  restoreProcess.stdin.end();

  let stderrData = '';
  restoreProcess.stderr.on('data', (chunk: Buffer) => {
    stderrData += chunk.toString();
  });

  await new Promise<void>((resolve, reject) => {
    restoreProcess.on('close', (code) => {
      // pg_restore returns non-zero for warnings too, so we log but don't fail
      if (code !== 0) {
        logger.warn({ code, stderr: stderrData }, 'pg_restore exited with warnings');
      }
      resolve();
    });
    restoreProcess.on('error', reject);
  });

  logAuditAction({
    organizationId,
    userId,
    action: 'backup.restored',
    resourceType: 'backup',
    resourceId: backupId,
    metadata: { backupName: backup.name, backupDate: backup.created_at },
    ipAddress,
  });

  logger.info({ backupId, organizationId }, 'Database restored from backup');
}

export async function deleteBackupWithFile(
  backupId: string,
  organizationId: string,
): Promise<void> {
  const backup = await backupModel.findBackupById(backupId, organizationId);
  if (!backup) {
    throw Object.assign(new Error('Backup not found'), { statusCode: 404 });
  }

  if (backup.file_key) {
    try {
      await deleteObject(backup.file_key);
    } catch (err) {
      logger.warn({ err, backupId, fileKey: backup.file_key }, 'Failed to delete backup file from storage');
    }
  }

  await backupModel.deleteBackup(backupId);
}

export async function cleanupExpiredBackups(organizationId: string): Promise<void> {
  const settings = await backupModel.getBackupSettings(organizationId);
  const retentionDays = settings?.retention_days || 30;

  const expired = await backupModel.findExpiredBackups(organizationId, retentionDays);
  for (const backup of expired) {
    try {
      if (backup.file_key) {
        await deleteObject(backup.file_key);
      }
      await backupModel.deleteBackup(backup.id);
      logger.info({ backupId: backup.id }, 'Expired backup cleaned up');
    } catch (err) {
      logger.warn({ err, backupId: backup.id }, 'Failed to clean up expired backup');
    }
  }
}

export async function initBackupScheduler(): Promise<void> {
  try {
    const enabledSettings = await backupModel.findAllEnabledSchedules();
    for (const settings of enabledSettings) {
      registerCronJob(settings.organization_id, settings.schedule_cron);
    }
    logger.info({ count: enabledSettings.length }, 'Backup scheduler initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize backup scheduler');
  }
}

export function updateSchedule(organizationId: string, enabled: boolean, cronExpr: string): void {
  const existing = scheduledJobs.get(organizationId);
  if (existing) {
    existing.stop();
    scheduledJobs.delete(organizationId);
  }

  if (enabled && cron.validate(cronExpr)) {
    registerCronJob(organizationId, cronExpr);
  }
}

function registerCronJob(organizationId: string, cronExpr: string): void {
  if (!cron.validate(cronExpr)) {
    logger.warn({ organizationId, cronExpr }, 'Invalid cron expression, skipping');
    return;
  }

  const job = cron.schedule(cronExpr, async () => {
    try {
      logger.info({ organizationId }, 'Starting scheduled backup');
      await startBackup({
        organizationId,
        name: 'Scheduled backup',
        triggeredBy: 'scheduled',
      });
    } catch (err) {
      logger.error({ err, organizationId }, 'Scheduled backup failed to start');
    }
  });

  scheduledJobs.set(organizationId, job);
  logger.info({ organizationId, cronExpr }, 'Backup schedule registered');
}
