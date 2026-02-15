import { z } from 'zod';

export const createBugReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  stepsToReproduce: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  screenshotBase64: z.string().optional().nullable(),
  consoleLogs: z.array(z.object({
    level: z.enum(['log', 'warn', 'error', 'info']),
    message: z.string(),
    timestamp: z.string(),
  })).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateBugReportSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  stepsToReproduce: z.string().max(5000).optional().nullable(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  resolutionNotes: z.string().max(5000).optional().nullable(),
});
