import { z } from 'zod';
import { ProductApprovalStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const adminProductsQuerySchema = paginationQuerySchema.extend({
  approvalStatus: z.nativeEnum(ProductApprovalStatus).optional(),
  sellerId: z.string().uuid().optional(),
});
export type AdminProductsQueryDto = z.infer<typeof adminProductsQuerySchema>;

export const adminSellersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
});
export type AdminSellersQueryDto = z.infer<typeof adminSellersQuerySchema>;
