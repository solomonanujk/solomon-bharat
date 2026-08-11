import { z } from 'zod';
import { CollectionStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  heroImage: z.string().url().optional(),
  editorialIntro: z.string().max(4000).optional(),
  isFeatured: z.boolean().optional(),
  status: z.nativeEnum(CollectionStatus).optional(),
  publishAt: z.coerce.date().optional(),
});
export type CreateCollectionDto = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(220).optional(),
  heroImage: z.string().url().optional(),
  editorialIntro: z.string().max(4000).optional(),
  publishAt: z.coerce.date().nullable().optional(),
});
export type UpdateCollectionDto = z.infer<typeof updateCollectionSchema>;

export const addProductSchema = z.object({
  productId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
});
export type AddProductDto = z.infer<typeof addProductSchema>;

export const reorderMembershipSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    }),
  )
  .min(1);
export type ReorderMembershipDto = z.infer<typeof reorderMembershipSchema>;

export const adminCollectionListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(CollectionStatus).optional(),
});
export type AdminCollectionListQueryDto = z.infer<typeof adminCollectionListQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
});
