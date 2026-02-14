import { z } from 'zod';

export const createBackupSchema = z.object({
  name: z.string().min(1).max(255).optional().default('Manual backup'),
});

export const updateBackupSettingsSchema = z.object({
  scheduleEnabled: z.boolean(),
  scheduleCron: z.string().min(9).max(100).optional().default('0 3 * * *'),
  retentionDays: z.number().int().min(1).max(365).optional().default(30),
});

export const restoreBackupSchema = z.object({
  confirmRestore: z.literal(true, {
    error: 'You must confirm the restore operation',
  }),
});
