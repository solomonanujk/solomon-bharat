import { z } from 'zod';

export const requestLinkSchema = z.object({
  phone: z.string().trim().min(8).max(25),
});

export const verifyLinkSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
