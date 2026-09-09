import { z } from 'zod';

const catalogueItemSchema = z.object({
  productId: z.string().uuid(),
  price: z.coerce.number().positive(),
  moq: z.coerce.number().int().positive(),
});

export const createCatalogueSchema = z.object({
  items: z.array(catalogueItemSchema).min(1).max(100),
  title: z.string().min(1).max(200).optional(),
});
export type CreateCatalogueDto = z.infer<typeof createCatalogueSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
