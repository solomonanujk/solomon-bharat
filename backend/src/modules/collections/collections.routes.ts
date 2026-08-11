import { Router } from 'express';
import { collectionsController } from './collections.controller';
import {
  addProductSchema,
  adminCollectionListQuerySchema,
  createCollectionSchema,
  idParamSchema,
  productIdParamSchema,
  reorderMembershipSchema,
  slugParamSchema,
  updateCollectionSchema,
} from './collections.validation';
import { paginationQuerySchema } from '../../utils/pagination';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const collectionsRouter = Router();

// ── Admin ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /collections/admin:
 *   get:
 *     summary: List all collections including drafts/archived (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collections list }
 */
collectionsRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminCollectionListQuerySchema, 'query'),
  asyncHandler(collectionsController.listAdmin),
);

/**
 * @openapi
 * /collections/admin/{id}:
 *   get:
 *     summary: Get collection detail with member products (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection detail }
 */
collectionsRouter.get(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.getAdminDetail),
);

/**
 * @openapi
 * /collections:
 *   post:
 *     summary: Create a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Collection created }
 */
collectionsRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(createCollectionSchema),
  asyncHandler(collectionsController.create),
);

/**
 * @openapi
 * /collections/{id}:
 *   patch:
 *     summary: Update a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Collection updated }
 */
collectionsRouter.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(updateCollectionSchema),
  asyncHandler(collectionsController.update),
);

/**
 * @openapi
 * /collections/{id}/publish:
 *   post:
 *     summary: Publish a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection published }
 */
collectionsRouter.post(
  '/:id/publish',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.publish),
);

/**
 * @openapi
 * /collections/{id}/unpublish:
 *   post:
 *     summary: Move a collection back to draft (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection moved to draft }
 */
collectionsRouter.post(
  '/:id/unpublish',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.unpublish),
);

/**
 * @openapi
 * /collections/{id}/archive:
 *   post:
 *     summary: Archive a collection — does not affect product visibility elsewhere (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection archived }
 */
collectionsRouter.post(
  '/:id/archive',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.archive),
);

/**
 * @openapi
 * /collections/{id}/feature:
 *   post:
 *     summary: Feature a collection on the homepage (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection featured }
 */
collectionsRouter.post(
  '/:id/feature',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.feature),
);

/**
 * @openapi
 * /collections/{id}/unfeature:
 *   post:
 *     summary: Unfeature a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Collection unfeatured }
 */
collectionsRouter.post(
  '/:id/unfeature',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(collectionsController.unfeature),
);

/**
 * @openapi
 * /collections/{id}/products:
 *   post:
 *     summary: Add an approved product to a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Product added }
 */
collectionsRouter.post(
  '/:id/products',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(addProductSchema),
  asyncHandler(collectionsController.addProduct),
);

/**
 * @openapi
 * /collections/{id}/products/reorder:
 *   patch:
 *     summary: Reorder a collection's product membership (SUPER_ADMIN only)
 *     tags: [Collections]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Products reordered }
 */
collectionsRouter.patch(
  '/:id/products/reorder',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(reorderMembershipSchema),
  asyncHandler(collectionsController.reorderMembership),
);

/**
 * @openapi
 * /collections/{id}/products/{productId}:
 *   delete:
 *     summary: Remove a product from a collection (SUPER_ADMIN only)
 *     tags: [Collections]
 *     responses:
 *       200: { description: Product removed }
 */
collectionsRouter.delete(
  '/:id/products/:productId',
  requireAuth,
  requireAdmin,
  validate(productIdParamSchema, 'params'),
  asyncHandler(collectionsController.removeProduct),
);

// ── Public ─────────────────────────────────────────────────────────────

/**
 * @openapi
 * /collections/featured:
 *   get:
 *     summary: Get featured collections for the homepage (public)
 *     tags: [Collections]
 *     security: []
 *     responses:
 *       200: { description: Featured collections }
 */
collectionsRouter.get('/featured', asyncHandler(collectionsController.listFeatured));

/**
 * @openapi
 * /collections:
 *   get:
 *     summary: List published collections (public)
 *     tags: [Collections]
 *     security: []
 *     responses:
 *       200: { description: Collections list }
 */
collectionsRouter.get(
  '/',
  validate(paginationQuerySchema, 'query'),
  asyncHandler(collectionsController.listPublic),
);

/**
 * @openapi
 * /collections/{slug}:
 *   get:
 *     summary: Get collection detail with product grid (public)
 *     tags: [Collections]
 *     security: []
 *     responses:
 *       200: { description: Collection detail }
 *       404: { description: Collection not found }
 */
collectionsRouter.get(
  '/:slug',
  validate(slugParamSchema, 'params'),
  asyncHandler(collectionsController.getPublicDetail),
);
