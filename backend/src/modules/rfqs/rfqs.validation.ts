import { RfqStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

// Sent as multipart (reference images), so every field arrives as a string.
export const createRfqSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().trim().min(10).max(5000),
  quantity: z.coerce.number().int().positive().max(10_000_000),
  targetPrice: z.coerce.number().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  destinationCountry: z.string().trim().min(2).max(100),
  deadline: z.coerce.date().optional(),
  /** A sample order from a product page (multipart sends 'true'). */
  isSample: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional(),
});
export type CreateRfqDto = z.infer<typeof createRfqSchema>;

export const adminRfqListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(RfqStatus).optional(),
});
export type AdminRfqListQueryDto = z.infer<typeof adminRfqListQuerySchema>;

export const updateRfqSchema = z
  .object({
    status: z.nativeEnum(RfqStatus).optional(),
    adminNotes: z.string().trim().max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, { message: 'Nothing to update' });
export type UpdateRfqDto = z.infer<typeof updateRfqSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });
