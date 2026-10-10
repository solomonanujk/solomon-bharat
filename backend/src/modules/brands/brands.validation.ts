import { z } from 'zod';
import { BrandStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const brandListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});
export type BrandListQueryDto = z.infer<typeof brandListQuerySchema>;

export const adminBrandListQuerySchema = brandListQuerySchema.extend({
  status: z.nativeEnum(BrandStatus).optional(),
});
export type AdminBrandListQueryDto = z.infer<typeof adminBrandListQuerySchema>;

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(120),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z.string().trim().url().max(500).nullable().optional();

// name / slug are deliberately absent — identity changes are admin-only.
export const updateOwnBrandSchema = z
  .object({
    logoUrl: optionalUrl,
    bannerUrl: optionalUrl,
    story: optionalText(1000),
    country: optionalText(100),
    website: optionalText(500),
    instagram: optionalText(100),
    returnPolicy: optionalText(2000),
    minOrderValueInr: z.coerce.number().min(0).max(100000000).optional(),
    legalName: optionalText(200),
    gstin: optionalText(20),
  })
  .strict();
export type UpdateOwnBrandDto = z.infer<typeof updateOwnBrandSchema>;

const percent = z.number().min(0).max(100);

export const adminUpdateBrandSchema = z
  .object({
    isVerified: z.boolean().optional(),
    status: z.nativeEnum(BrandStatus).optional(),
    name: z.string().trim().min(2).max(60).optional(),
    commissionFirstOverride: percent.nullable().optional(),
    commissionRepeatOverride: percent.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type AdminUpdateBrandDto = z.infer<typeof adminUpdateBrandSchema>;

export const commissionDefaultsSchema = z.object({
  first: percent,
  repeat: percent,
});
export type CommissionDefaultsDto = z.infer<typeof commissionDefaultsSchema>;
