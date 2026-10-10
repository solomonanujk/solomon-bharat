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

const stockSchema = z.number().int().min(0).max(IMPORT_LIMITS.maxStock).nullable();
const weightSchema = z.number().finite().positive().max(IMPORT_LIMITS.maxWeightKg).nullable();
const sideSchema = z.number().finite().positive().max(IMPORT_LIMITS.maxDimension);
const dimensionsObjectSchema = z.object({
  length: sideSchema,
  width: sideSchema,
  height: sideSchema,
  unit: z.enum(['cm', 'in']),
});
// Same shape ProductForm.parseDimensions reads back.
const dimensionsStringSchema = z
  .string()
  .max(200)
  .regex(/^[\d.]+\s*x\s*[\d.]+\s*x\s*[\d.]+\s*(cm|in)$/i, 'Dimensions must look like "L x W x H cm"');

const variantSchema = z.object({
  name: z.string().trim().min(1).max(IMPORT_LIMITS.variantName),
  options: optionsSchema,
  sku: z.string().trim().min(1).max(IMPORT_LIMITS.sku).nullable(),
  sellerPrice: priceSchema,
  stock: stockSchema.optional(),
  weightKg: weightSchema.optional(),
  dimensions: dimensionsObjectSchema.nullable().optional(),
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
  published: z.enum(['published', 'private', 'draft']).nullable().optional(),
  weightKg: weightSchema.optional(),
  dimensions: dimensionsStringSchema.nullable().optional(),
  stock: stockSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(IMPORT_LIMITS.tagLength)).max(IMPORT_LIMITS.tags).optional(),
  // Informational (the file's own category words) — never persisted.
  categoryPath: z
    .array(z.array(z.string().trim().min(1).max(IMPORT_LIMITS.categorySegment)).min(1).max(IMPORT_LIMITS.categoryPathDepth))
    .max(IMPORT_LIMITS.categoryPaths)
    .optional(),
  // Informational — echoed back by the client, ignored on import (categoryId decides).
  suggestedCategory: z
    .object({ id: z.string().max(100), name: z.string().max(200), path: z.string().max(500) })
    .nullable()
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const importProductsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  products: z.array(candidateSchema).min(1).max(100),
});
export type ImportProductsDto = z.infer<typeof importProductsSchema>;

export const sellerProfileIdParamSchema = z.object({
  sellerProfileId: z.string().uuid(),
});
export type SellerProfileIdParamDto = z.infer<typeof sellerProfileIdParamSchema>;
