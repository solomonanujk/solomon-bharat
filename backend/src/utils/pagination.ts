import { z } from 'zod';
import { PaginationMeta } from './response';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function toSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function buildPaginationMeta(
  total: number,
  query: PaginationQuery,
): PaginationMeta {
  return {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
