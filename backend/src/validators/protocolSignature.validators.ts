import { z } from 'zod';

export const createSigningLinkSchema = z.object({
  email: z.string().email().optional(),
});

export const submitSignatureSchema = z.object({
  signerName: z.string().min(1).max(255),
  signerEmail: z.string().email().max(255),
  signatureData: z.string().min(1),
});
