import { z } from 'zod';

// multipart/form-data sends every field as a string — coerce "true"/"false" explicitly
// rather than z.coerce.boolean(), which would treat the string "false" as truthy.
function formBoolean() {
  return z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional();
}

// heroImage now arrives as an uploaded file (req.file), not a body field — see
// categories.routes.ts / categories.controller.ts. `level` is coerced from a string
// since multipart bodies never carry numeric literals.
export const createCategorySchema = z
  .object({
    name: z.string().min(1).max(150),
    level: z.preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ),
    parentId: z.string().uuid().optional(),
    description: z.string().max(2000).optional(),
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
  sortOrder: z.coerce.number().int().min(0).optional(),
  // Clears the hero image without uploading a replacement.
  removeHeroImage: formBoolean(),
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
