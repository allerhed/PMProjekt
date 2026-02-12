import { z } from 'zod';

export const entityTypeEnum = z.enum(['project', 'task', 'product', 'user']);
export const fieldTypeEnum = z.enum(['text', 'number', 'date', 'select', 'textarea', 'checkbox']);

export const createCustomFieldSchema = z.object({
  entityType: entityTypeEnum,
  label: z.string().min(1, 'Label is required').max(255),
  fieldType: fieldTypeEnum,
  options: z.array(z.string().min(1)).optional(),
  isRequired: z.boolean().optional().default(false),
  displayOrder: z.number().int().min(0).optional(),
}).refine(
  (data) => data.fieldType !== 'select' || (data.options && data.options.length > 0),
  { message: 'Options are required for select fields', path: ['options'] },
);

export const updateCustomFieldSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  fieldType: fieldTypeEnum.optional(),
  options: z.array(z.string().min(1)).nullable().optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const reorderCustomFieldsSchema = z.object({
  entityType: entityTypeEnum,
  orderedIds: z.array(z.string().uuid()).min(1),
});
