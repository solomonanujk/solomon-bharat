import { Router } from 'express';
import { categoriesController } from './categories.controller';
import {
  categoryIdParamSchema,
  categorySlugParamSchema,
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from './categories.validation';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAdmin, requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const categoriesRouter = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: Get the active category tree (3 levels, with published product counts)
 *     tags: [Categories]
 *     security: []
 *     responses:
 *       200: { description: Category tree }
 */
categoriesRouter.get('/', asyncHandler(categoriesController.getPublicTree));

/**
 * @openapi
 * /categories/admin/tree:
 *   get:
 *     summary: Get the full category tree including archived nodes (admin)
 *     tags: [Categories]
 *     responses:
 *       200: { description: Category tree }
 */
categoriesRouter.get(
  '/admin/tree',
  requireAuth,
  requireAdmin,
  asyncHandler(categoriesController.getAdminTree),
);

/**
 * @openapi
 * /categories/{slug}:
 *   get:
 *     summary: Get category detail with breadcrumb and children
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Category detail }
 *       404: { description: Category not found }
 */
categoriesRouter.get(
  '/:slug',
  optionalAuth,
  validate(categorySlugParamSchema, 'params'),
  asyncHandler(categoriesController.getBySlug),
);

/**
 * @openapi
 * /categories:
 *   post:
 *     summary: Create a category (SUPER_ADMIN only)
 *     tags: [Categories]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Category created }
 */
categoriesRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(createCategorySchema),
  asyncHandler(categoriesController.create),
);

/**
 * @openapi
 * /categories/reorder:
 *   patch:
 *     summary: Reorder sibling categories (SUPER_ADMIN only)
 *     tags: [Categories]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Categories reordered }
 */
categoriesRouter.patch(
  '/reorder',
  requireAuth,
  requireAdmin,
  validate(reorderCategoriesSchema),
  asyncHandler(categoriesController.reorder),
);

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     summary: Update a category (SUPER_ADMIN only)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Category updated }
 */
categoriesRouter.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema),
  asyncHandler(categoriesController.update),
);

/**
 * @openapi
 * /categories/{id}/archive:
 *   post:
 *     summary: Archive a category, blocked if active products remain (SUPER_ADMIN only)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Category archived }
 *       409: { description: Active products still assigned }
 */
categoriesRouter.post(
  '/:id/archive',
  requireAuth,
  requireAdmin,
  validate(categoryIdParamSchema, 'params'),
  asyncHandler(categoriesController.archive),
);

/**
 * @openapi
 * /categories/{id}/restore:
 *   post:
 *     summary: Restore an archived category (SUPER_ADMIN only)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Category restored }
 */
categoriesRouter.post(
  '/:id/restore',
  requireAuth,
  requireAdmin,
  validate(categoryIdParamSchema, 'params'),
  asyncHandler(categoriesController.restore),
);
