import { z } from 'zod';

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
});
