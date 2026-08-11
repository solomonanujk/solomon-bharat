import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const listQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
export type ListQueryDto = z.infer<typeof listQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
