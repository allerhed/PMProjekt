import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
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

export async function listBackupTables(
  backupId: string,
  organizationId: string,
): Promise<string[]> {
  const backup = await backupModel.findBackupById(backupId, organizationId);
  if (!backup || backup.status !== 'completed' || !backup.file_key) {
    throw Object.assign(new Error('Backup not available'), { statusCode: 404 });
  }

  const backupData = await readFile(backup.file_key);
  const tmpFile = path.join(os.tmpdir(), `backup-toc-${backup.id}-${Date.now()}.dump`);

  try {
    await fs.writeFile(tmpFile, backupData);

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('pg_restore', ['-l', tmpFile], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        // pg_restore -l may return non-zero for warnings
        if (code !== 0 && !stdout) {
          reject(new Error(`pg_restore -l failed (code ${code}): ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });
      proc.on('error', reject);
    });

    // Parse TOC lines like: "123; 1259 16389 TABLE public users construction_admin"
    const tables = new Set<string>();
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith(';')) continue; // comment line
      // Format: <id>; <oid> <oid> <type> <schema> <name> <owner>
      const match = trimmed.match(/^\d+;\s+\d+\s+\d+\s+TABLE\s+\S+\s+(\S+)\s+/);
      if (match) {
        tables.add(match[1]);
      }
    }

    return Array.from(tables).sort();
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

export async function restoreFromBackup(
  backupId: string,
  organizationId: string,
  userId: string,
  ipAddress?: string,
  tables?: string[],
): Promise<void> {
  const backup = await backupModel.findBackupById(backupId, organizationId);
  if (!backup || backup.status !== 'completed' || !backup.file_key) {
    throw Object.assign(new Error('Backup not available for restore'), { statusCode: 404 });
  }

  const db = parseDatabaseUrl(config.db.url);
  const backupData = await readFile(backup.file_key);

  const args: string[] = [];

  if (tables && tables.length > 0) {
    // Selective restore: restore only specified tables with --clean for those tables
    args.push('--clean', '--if-exists');
    for (const table of tables) {
      args.push('-t', table);
    }
  } else {
    // Full restore: clean everything
    args.push('--clean', '--if-exists');
  }

  args.push(
    '--no-owner', '--no-acl',
    '-h', db.host,
    '-p', db.port,
    '-U', db.user,
    '-d', db.database,
  );

  const restoreProcess = spawn('pg_restore', args, {
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
    metadata: {
      backupName: backup.name,
      backupDate: backup.created_at,
      restoreType: tables && tables.length > 0 ? 'selective' : 'full',
      ...(tables && tables.length > 0 ? { tables } : {}),
    },
    ipAddress,
  });

  logger.info({ backupId, organizationId, tables: tables || 'all' }, 'Database restored from backup');
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
