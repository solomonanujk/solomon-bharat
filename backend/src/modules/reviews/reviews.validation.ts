import { z } from 'zod';

export const submitReviewSchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});
export type SubmitReviewDto = z.infer<typeof submitReviewSchema>;

export const listReviewsQuerySchema = z.object({
  productId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListReviewsQueryDto = z.infer<typeof listReviewsQuerySchema>;
