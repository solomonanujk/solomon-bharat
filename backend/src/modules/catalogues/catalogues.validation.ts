import { z } from 'zod';

const catalogueItemSchema = z.object({
  productId: z.string().uuid(),
  /** Legacy field — accepted but never printed: catalogues carry no pricing. */
  price: z.coerce.number().positive().optional(),
  moq: z.coerce.number().int().positive(),
});

export const createCatalogueSchema = z.object({
  items: z.array(catalogueItemSchema).min(1).max(100),
  title: z.string().min(1).max(200).optional(),
  /** The agent's own contact details — the only identity printed on the PDF. */
  contact: z.object({
    companyName: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(5).max(40),
    email: z.string().trim().email().max(200),
  }),
});
export type CreateCatalogueDto = z.infer<typeof createCatalogueSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
