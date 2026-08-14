import { z } from 'zod';
import { ProductApprovalStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

function jsonArrayField<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val; // let the array schema below reject it with a clear message
      }
    }
    return val;
  }, z.array(schema).optional());
}

// multipart/form-data sends every field as a string — coerce "true"/"false" explicitly
// rather than z.coerce.boolean(), which would treat the string "false" as truthy.
function formBoolean(defaultValue: boolean) {
  return z
    .preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .default(defaultValue);
}

const priceTierSchema = z.object({
  moq: z.number().int().positive(),
  sellerPrice: z.number().positive(),
});

const variantAttributeSchema = z.object({
  name: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
});

const variantSchema = z.object({
  type: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
  sku: z.string().min(1).max(100).optional(),
  sellerPrice: z.number().positive().optional(),
  moq: z.number().int().positive().optional(),
  stock: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).default('ACTIVE'),
  imageUrl: z.string().url().optional(),
  attributes: z.array(variantAttributeSchema).min(1).optional(),
  priceTiers: z.array(priceTierSchema).min(1).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  categoryId: z.string().uuid(),
  materials: z.string().min(1).max(500),
  dimensions: z.string().max(200).optional(),
  weight: z
    .string()
    .min(1)
    .refine((v) => Number(v) > 0, 'Weight must be a positive number (kg)'),
  moq: z.coerce.number().int().min(1),
  declaredStock: z.coerce.number().int().min(0),
  sellerPrice: z.coerce.number().positive(),
  leadTime: z.string().max(200).optional(),
  certifications: z.string().max(500).optional(),
  variants: jsonArrayField(variantSchema),
  tags: jsonArrayField(z.string().min(1).max(50)),
  stepQty: z.coerce.number().int().positive().default(1),
  lengthCm: z.coerce.number().positive().optional(),
  breadthCm: z.coerce.number().positive().optional(),
  heightCm: z.coerce.number().positive().optional(),
  isHandmade: formBoolean(false),
  placeOfOrigin: z.string().max(200).optional(),
  isGITagged: formBoolean(false),
  howItIsMade: z.string().max(5000).optional(),
  artisanName: z.string().max(200).optional(),
  priceTiers: jsonArrayField(priceTierSchema),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  materials: z.string().min(1).max(500).optional(),
  dimensions: z.string().max(200).optional(),
  weight: z.string().max(100).optional(),
  moq: z.coerce.number().int().min(1).optional(),
  declaredStock: z.coerce.number().int().min(0).optional(),
  sellerPrice: z.coerce.number().positive().optional(),
  leadTime: z.string().max(200).optional(),
  certifications: z.string().max(500).optional(),
  variants: jsonArrayField(variantSchema),
  removeImageIds: jsonArrayField(z.string().uuid()),
  tags: jsonArrayField(z.string().min(1).max(50)),
  stepQty: z.coerce.number().int().positive().optional(),
  lengthCm: z.coerce.number().positive().optional(),
  breadthCm: z.coerce.number().positive().optional(),
  heightCm: z.coerce.number().positive().optional(),
  isHandmade: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  placeOfOrigin: z.string().max(200).optional(),
  isGITagged: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  howItIsMade: z.string().max(5000).optional(),
  artisanName: z.string().max(200).optional(),
  priceTiers: jsonArrayField(priceTierSchema),
});
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const polishFieldSchema = z.object({
  field: z.enum(['name', 'description', 'tags']),
  value: z.string().max(5000),
});
export type PolishFieldDto = z.infer<typeof polishFieldSchema>;

export const approveProductSchema = z.object({
  adminPrice: z.coerce.number().positive(),
});
export type ApproveProductDto = z.infer<typeof approveProductSchema>;

export const rejectProductSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type RejectProductDto = z.infer<typeof rejectProductSchema>;

export const updatePriceSchema = z.object({
  adminPrice: z.coerce.number().positive(),
});
export type UpdatePriceDto = z.infer<typeof updatePriceSchema>;

export const reassignCategorySchema = z.object({
  categoryId: z.string().uuid(),
});
export type ReassignCategoryDto = z.infer<typeof reassignCategorySchema>;

export const publicProductListQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  material: z.string().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  moqMax: z.coerce.number().int().min(1).optional(),
});
export type PublicProductListQueryDto = z.infer<typeof publicProductListQuerySchema>;

export const adminProductListQuerySchema = paginationQuerySchema.extend({
  approvalStatus: z.nativeEnum(ProductApprovalStatus).optional(),
  sellerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});
export type AdminProductListQueryDto = z.infer<typeof adminProductListQuerySchema>;

export const sellerProductListQuerySchema = paginationQuerySchema.extend({
  approvalStatus: z.nativeEnum(ProductApprovalStatus).optional(),
});
export type SellerProductListQueryDto = z.infer<typeof sellerProductListQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});
