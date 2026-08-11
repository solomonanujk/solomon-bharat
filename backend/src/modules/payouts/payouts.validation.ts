import { z } from 'zod';
import { PayoutStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const markPaidSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type MarkPaidDto = z.infer<typeof markPaidSchema>;

export const addNotesSchema = z.object({
  notes: z.string().min(1).max(1000),
});
export type AddNotesDto = z.infer<typeof addNotesSchema>;

export const payoutListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(PayoutStatus).optional(),
});
export type PayoutListQueryDto = z.infer<typeof payoutListQuerySchema>;

export const adminPayoutListQuerySchema = payoutListQuerySchema.extend({
  sellerId: z.string().uuid().optional(),
});
export type AdminPayoutListQueryDto = z.infer<typeof adminPayoutListQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
