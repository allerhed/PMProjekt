import { z } from 'zod';

export const taskReportQuerySchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});
