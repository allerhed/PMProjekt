import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  productId: z.string().max(100).optional(),
  description: z.string().optional(),
  link: z.string().url('Must be a valid URL').max(500).optional().or(z.literal('')),
  comment: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  productId: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  link: z.string().url('Must be a valid URL').max(500).optional().nullable().or(z.literal('')),
  comment: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const addProductToTaskSchema = z.object({
  productId: z.string().uuid('Product ID must be a valid UUID'),
});
