import { z } from 'zod';

export const createCommentSchema = z.object({
  commentText: z.string().min(1, 'Comment text is required').max(5000),
});
