import { z } from 'zod';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
const ALLOWED_BLUEPRINT_TYPES = ['application/pdf'] as const;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BLUEPRINT_SIZE = 50 * 1024 * 1024; // 50 MB

export const requestPhotoUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_PHOTO_SIZE, `File size must not exceed ${MAX_PHOTO_SIZE / (1024 * 1024)} MB`),
  mimeType: z.enum(ALLOWED_PHOTO_TYPES, {
    message: `Allowed types: ${ALLOWED_PHOTO_TYPES.join(', ')}`,
  }),
  caption: z.string().max(500).optional(),
});

export const requestBlueprintUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_BLUEPRINT_SIZE, `File size must not exceed ${MAX_BLUEPRINT_SIZE / (1024 * 1024)} MB`),
  mimeType: z.enum(ALLOWED_BLUEPRINT_TYPES, {
    message: `Allowed types: ${ALLOWED_BLUEPRINT_TYPES.join(', ')}`,
  }),
  name: z.string().min(1, 'Blueprint name is required').max(255),
});

export type RequestPhotoUpload = z.infer<typeof requestPhotoUploadSchema>;
export type RequestBlueprintUpload = z.infer<typeof requestBlueprintUploadSchema>;
