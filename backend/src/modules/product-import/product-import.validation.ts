import { z } from 'zod';
import { IMPORT_LIMITS, isHttpUrl } from './parsers/shared';

// The import body is the preview's output echoed back by the client — i.e. untrusted.
// Every field is re-validated and capped here with the same limits the parser applies.

const priceSchema = z.number().finite().positive().max(IMPORT_LIMITS.maxPrice).nullable();

const optionsSchema = z
  .record(z.string().trim().min(1).max(IMPORT_LIMITS.optionName), z.string().trim().min(1).max(IMPORT_LIMITS.optionValue))
  .refine((o) => Object.keys(o).length <= IMPORT_LIMITS.optionsPerVariant, {
    message: `At most ${IMPORT_LIMITS.optionsPerVariant} options per variant`,
  });

const variantSchema = z.object({
  name: z.string().trim().min(1).max(IMPORT_LIMITS.variantName),
  options: optionsSchema,
  sku: z.string().trim().min(1).max(IMPORT_LIMITS.sku).nullable(),
  sellerPrice: priceSchema,
});

const candidateSchema = z.object({
  key: z.string().trim().min(1).max(IMPORT_LIMITS.key),
  name: z.string().trim().min(1).max(IMPORT_LIMITS.name),
  description: z.string().max(IMPORT_LIMITS.description).nullable(),
  imageUrls: z
    .array(z.string().trim().max(IMPORT_LIMITS.imageUrl).refine(isHttpUrl, 'Image URLs must be http(s) links'))
    .max(IMPORT_LIMITS.imagesPerProduct),
  sellerPrice: priceSchema,
  variants: z.array(variantSchema).max(IMPORT_LIMITS.variantsPerProduct),
  materials: z.string().max(IMPORT_LIMITS.materials).nullable(),
  // Informational only (shown in the preview) — accepted so the client can echo the
  // candidate back unchanged, but bounded and never persisted.
  issues: z.array(z.string().max(500)).max(50).default([]),
});

export const importProductsSchema = z.object({
  categoryId: z.string().uuid(),
  products: z.array(candidateSchema).min(1).max(100),
});
export type ImportProductsDto = z.infer<typeof importProductsSchema>;

export const sellerProfileIdParamSchema = z.object({
  sellerProfileId: z.string().uuid(),
});
export type SellerProfileIdParamDto = z.infer<typeof sellerProfileIdParamSchema>;
