import { z } from 'zod';

export const generateProtocolSchema = z.object({
  name: z.string().min(1, 'Protocol name is required').max(255),
  filters: z.object({
    status: z.string().optional(),
    trade: z.string().optional(),
    priority: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).optional().default({}),
});

export type GenerateProtocolBody = z.infer<typeof generateProtocolSchema>;
