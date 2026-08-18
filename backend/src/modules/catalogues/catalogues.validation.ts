import { z } from 'zod';

export const createCatalogueSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(100),
  title: z.string().min(1).max(200).optional(),
});
export type CreateCatalogueDto = z.infer<typeof createCatalogueSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
