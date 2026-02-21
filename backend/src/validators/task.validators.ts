import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
  trade: z.string().max(50).optional(),
  blueprintId: z.string().uuid().optional(),
  locationX: z.number().min(0).max(1).optional(),
  locationY: z.number().min(0).max(1).optional(),
  assignedToUser: z.string().uuid().optional(),
  assignedToContractorEmail: z.string().email().optional(),
  annotationX: z.number().min(0).max(1).nullable().optional(),
  annotationY: z.number().min(0).max(1).nullable().optional(),
  annotationWidth: z.number().min(0).max(1).nullable().optional(),
  annotationHeight: z.number().min(0).max(1).nullable().optional(),
  annotationPage: z.number().int().min(1).nullable().optional(),
  annotationMarkers: z.array(z.object({
    id: z.string().uuid(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    page: z.number().int().min(1),
  })).nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'verified']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  trade: z.string().max(50).nullable().optional(),
  blueprintId: z.string().uuid().nullable().optional(),
  locationX: z.number().min(0).max(1).nullable().optional(),
  locationY: z.number().min(0).max(1).nullable().optional(),
  assignedToUser: z.string().uuid().nullable().optional(),
  assignedToContractorEmail: z.string().email().nullable().optional(),
  annotationX: z.number().min(0).max(1).nullable().optional(),
  annotationY: z.number().min(0).max(1).nullable().optional(),
  annotationWidth: z.number().min(0).max(1).nullable().optional(),
  annotationHeight: z.number().min(0).max(1).nullable().optional(),
  annotationPage: z.number().int().min(1).nullable().optional(),
  annotationMarkers: z.array(z.object({
    id: z.string().uuid(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    page: z.number().int().min(1),
  })).nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const taskFiltersSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'verified']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  trade: z.string().optional(),
  assignedToMe: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
