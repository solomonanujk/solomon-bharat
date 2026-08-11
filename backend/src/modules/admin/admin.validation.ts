import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportQuerySchema = dateRangeQuerySchema.extend({
  type: z.enum([
    'revenue',
    'orders-by-status',
    'orders-by-country',
    'sellers-performance',
    'products-performance',
    'categories-performance',
    'collections-performance',
  ]),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ReportQueryDto = z.infer<typeof reportQuerySchema>;

export const auditLogQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().min(1).optional(),
  adminId: z.string().uuid().optional(),
});
export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;

export const userListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(['SUPER_ADMIN', 'SELLER', 'BUYER']).optional(),
});
export type UserListQueryDto = z.infer<typeof userListQuerySchema>;

export const upsertSettingSchema = z.object({
  value: z.unknown(),
});
export type UpsertSettingDto = z.infer<typeof upsertSettingSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const keyParamSchema = z.object({
  key: z.string().min(1),
});
