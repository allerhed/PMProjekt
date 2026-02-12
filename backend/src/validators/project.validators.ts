import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  startDate: z.string().optional(),
  targetCompletionDate: z.string().optional(),
  responsibleUserId: z.string().uuid().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  startDate: z.string().nullable().optional(),
  targetCompletionDate: z.string().nullable().optional(),
  responsibleUserId: z.string().uuid().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});
