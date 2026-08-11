import { z } from 'zod';

export const createCategorySchema = z
  .object({
    name: z.string().min(1).max(150),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    parentId: z.string().uuid().optional(),
    description: z.string().max(2000).optional(),
    heroImage: z.string().url().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((data) => (data.level === 1 ? !data.parentId : Boolean(data.parentId)), {
    message: 'Level 1 categories must not have a parent; level 2/3 categories require one',
    path: ['parentId'],
  });
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  slug: z.string().min(1).max(180).optional(),
  description: z.string().max(2000).optional(),
  heroImage: z.string().url().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    }),
  )
  .min(1);
export type ReorderCategoriesDto = z.infer<typeof reorderCategoriesSchema>;

export const categoryIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const categorySlugParamSchema = z.object({
  slug: z.string().min(1),
});
