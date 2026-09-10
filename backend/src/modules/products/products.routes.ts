import { Router } from 'express';
import { productsController } from './products.controller';
import {
  adminProductListQuerySchema,
  approvePricingChangeSchema,
  approveProductSchema,
  createProductAsAdminSchema,
  createProductSchema,
  idParamSchema,
  polishFieldSchema,
  publicProductListQuerySchema,
  reassignCategorySchema,
  rejectProductSchema,
  sellerProductListQuerySchema,
  slugParamSchema,
  updatePriceSchema,
  updateProductSchema,
} from './products.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireBuyerOrAgent, requireSeller, optionalAuth } from '../../middleware/auth';
import { uploadImages } from '../../middleware/upload';
import { asyncHandler } from '../../utils/asyncHandler';
import { paginationQuerySchema } from '../../utils/pagination';

export const productsRouter = Router();

const imagesUpload = uploadImages.array('images', 10);

// ── Seller: own products ──────────────────────────────────────────────

/**
 * @openapi
 * /products/me:
 *   get:
 *     summary: List my own products (SELLER only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Products list }
 */
productsRouter.get(
  '/me',
  requireAuth,
  requireSeller,
  validate(sellerProductListQuerySchema, 'query'),
  asyncHandler(productsController.listMine),
);

/**
 * @openapi
 * /products/me/{id}:
 *   get:
 *     summary: Get one of my own products (SELLER only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product detail }
 */
productsRouter.get(
  '/me/:id',
  requireAuth,
  requireSeller,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.getMine),
);

/**
 * @openapi
 * /products/me/{id}:
 *   patch:
 *     summary: Edit my own product (SELLER only, blocked once approved)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product updated }
 */
productsRouter.patch(
  '/me/:id',
  requireAuth,
  requireSeller,
  imagesUpload,
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

/**
 * @openapi
 * /products/me/{id}/resubmit:
 *   post:
 *     summary: Resubmit a rejected product for review (SELLER only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product resubmitted }
 */
productsRouter.post(
  '/me/:id/resubmit',
  requireAuth,
  requireSeller,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.resubmit),
);

/**
 * @openapi
 * /products/me/{id}:
 *   delete:
 *     summary: Delete (soft) my own product (SELLER only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product deleted }
 */
productsRouter.delete(
  '/me/:id',
  requireAuth,
  requireSeller,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.remove),
);

// ── Admin: review & manage ────────────────────────────────────────────

/**
 * @openapi
 * /products/admin:
 *   get:
 *     summary: List products for review/management (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Products list with seller price and margin }
 */
productsRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminProductListQuerySchema, 'query'),
  asyncHandler(productsController.listAdmin),
);

/**
 * @openapi
 * /products/admin/pricing-changes:
 *   get:
 *     summary: List sellers' pending pricing/variant changes on already-approved products (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Pending pricing changes list }
 */
// Registered before /admin/:id — an :id param route declared first would swallow
// this literal "pricing-changes" segment (same reasoning as /agent before /:slug below).
productsRouter.get(
  '/admin/pricing-changes',
  requireAuth,
  requireAdmin,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(productsController.listPendingPricingChanges),
);

/**
 * @openapi
 * /products/admin/pricing-changes/{id}/approve:
 *   post:
 *     summary: Approve a pending pricing/variant change, pricing the new tiers as part of approving (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Pricing change approved and applied to the live product }
 */
productsRouter.post(
  '/admin/pricing-changes/:id/approve',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(approvePricingChangeSchema),
  asyncHandler(productsController.approvePricingChange),
);

/**
 * @openapi
 * /products/admin/pricing-changes/{id}/reject:
 *   post:
 *     summary: Reject a pending pricing/variant change with a reason — the live product/pricing is left untouched (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Pricing change rejected }
 */
productsRouter.post(
  '/admin/pricing-changes/:id/reject',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(rejectProductSchema),
  asyncHandler(productsController.rejectPricingChange),
);

/**
 * @openapi
 * /products/admin/{id}:
 *   get:
 *     summary: Get full product detail for admin review (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product detail }
 */
productsRouter.get(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.getAdmin),
);

/**
 * @openapi
 * /products/admin/{id}:
 *   patch:
 *     summary: Edit full product details as admin (SUPER_ADMIN only) — unlike the seller edit route, works on approved products too and has no ownership check
 *     tags: [Products]
 *     responses:
 *       200: { description: Product updated }
 */
productsRouter.patch(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  imagesUpload,
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(productsController.updateAdmin),
);

/**
 * @openapi
 * /products/admin/{id}/approve:
 *   post:
 *     summary: Approve a product and set its selling price (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Product approved and published }
 */
productsRouter.post(
  '/admin/:id/approve',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(approveProductSchema),
  asyncHandler(productsController.approve),
);

/**
 * @openapi
 * /products/admin/{id}/reject:
 *   post:
 *     summary: Reject a product with a reason (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Product rejected }
 */
productsRouter.post(
  '/admin/:id/reject',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(rejectProductSchema),
  asyncHandler(productsController.reject),
);

/**
 * @openapi
 * /products/admin/{id}/price:
 *   patch:
 *     summary: Update the selling price of an approved product (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Selling price updated }
 */
productsRouter.patch(
  '/admin/:id/price',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(updatePriceSchema),
  asyncHandler(productsController.updatePrice),
);

/**
 * @openapi
 * /products/admin/{id}/category:
 *   patch:
 *     summary: Reassign a product to a different level-3 category (SUPER_ADMIN only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Product reassigned }
 */
productsRouter.patch(
  '/admin/:id/category',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(reassignCategorySchema),
  asyncHandler(productsController.reassignCategory),
);

/**
 * @openapi
 * /products/admin/{id}/publish:
 *   post:
 *     summary: Publish an approved product (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product published }
 */
productsRouter.post(
  '/admin/:id/publish',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.publish),
);

/**
 * @openapi
 * /products/admin/{id}/unpublish:
 *   post:
 *     summary: Unpublish a product (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product unpublished }
 */
productsRouter.post(
  '/admin/:id/unpublish',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.unpublish),
);

/**
 * @openapi
 * /products/admin/{id}/feature:
 *   post:
 *     summary: Feature a product (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product featured }
 */
productsRouter.post(
  '/admin/:id/feature',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.feature),
);

/**
 * @openapi
 * /products/admin/{id}/unfeature:
 *   post:
 *     summary: Unfeature a product (SUPER_ADMIN only)
 *     tags: [Products]
 *     responses:
 *       200: { description: Product unfeatured }
 */
productsRouter.post(
  '/admin/:id/unfeature',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(productsController.unfeature),
);

/**
 * @openapi
 * /products/ai/polish:
 *   post:
 *     summary: AI-polish a name/description/tags field before submitting (SELLER only)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Cleaned field value }
 */
productsRouter.post(
  '/ai/polish',
  requireAuth,
  requireSeller,
  validate(polishFieldSchema),
  asyncHandler(productsController.polish),
);

// ── Seller: create ────────────────────────────────────────────────────

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Submit a new product for review (SELLER only, 2-10 images)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Product submitted for review }
 */
productsRouter.post(
  '/',
  requireAuth,
  requireSeller,
  imagesUpload,
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

// ── Admin: create directly (skips PENDING review — admin prices it right here) ──

/**
 * @openapi
 * /products/admin:
 *   post:
 *     summary: Create a product directly as admin — on behalf of an existing seller or as admin's own (house) inventory — already APPROVED and published (SUPER_ADMIN only, 2-10 images)
 *     tags: [Products]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Product created and published }
 */
productsRouter.post(
  '/admin',
  requireAuth,
  requireAdmin,
  imagesUpload,
  validate(createProductAsAdminSchema),
  asyncHandler(productsController.createAsAdmin),
);

// ── Public: context-scoped browsing ───────────────────────────────────

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Browse published products — scoped to a category/collection, or a bare global search/sort mode (public)
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: collectionId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Global search (name/description/materials) — doesn't need categoryId/collectionId.
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, featured] }
 *         description: Curated unscoped browse mode (navbar "New Products"/"Bestsellers") — also doesn't need categoryId/collectionId.
 *     responses:
 *       200: { description: Products list }
 *       400: { description: None of categoryId, collectionId, search, or sort was supplied }
 */
productsRouter.get(
  '/',
  optionalAuth,
  validate(publicProductListQuerySchema, 'query'),
  asyncHandler(productsController.listPublic),
);

/**
 * @openapi
 * /products/recommendations:
 *   get:
 *     summary: Personalized product feed for the authenticated buyer or agent
 *     description: >
 *       The one deliberate exception to the "no unscoped browsing" rule — biased
 *       toward the buyer's wishlist/order-history categories, backfilled with
 *       featured/recent products so the feed is always full.
 *     tags: [Products]
 *     responses:
 *       200: { description: Recommended products list }
 */
productsRouter.get(
  '/recommendations',
  requireAuth,
  requireBuyerOrAgent,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(productsController.listRecommended),
);

/**
 * @openapi
 * /products/facets/place-of-origin:
 *   get:
 *     summary: Distinct real placeOfOrigin values among published products (public) — powers the "Made in" filter's checkbox list
 *     tags: [Products]
 *     security: []
 *     responses:
 *       200: { description: List of distinct place-of-origin strings }
 */
// Registered before /:slug — an :slug param route declared first would swallow
// this literal "facets" segment.
productsRouter.get(
  '/facets/place-of-origin',
  asyncHandler(productsController.listPlaceOfOriginFacets),
);

/**
 * @openapi
 * /products/{slug}:
 *   get:
 *     summary: Get published product detail (public; priced with agentPrice too when the viewer is an authenticated agent)
 *     tags: [Products]
 *     security: []
 *     responses:
 *       200: { description: Product detail with related products }
 *       404: { description: Product not found }
 */
productsRouter.get(
  '/:slug',
  optionalAuth,
  validate(slugParamSchema, 'params'),
  asyncHandler(productsController.getBySlug),
);
