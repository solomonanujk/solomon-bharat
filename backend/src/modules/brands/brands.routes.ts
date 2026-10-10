import { Router } from 'express';
import { brandsController } from './brands.controller';
import {
  adminBrandListQuerySchema,
  adminUpdateBrandSchema,
  brandListQuerySchema,
  commissionDefaultsSchema,
  idParamSchema,
  slugParamSchema,
  updateOwnBrandSchema,
} from './brands.validation';
import { paginationQuerySchema } from '../../utils/pagination';
import { validate } from '../../middleware/validate';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireBuyer,
  requireMarketplaceSeller,
} from '../../middleware/auth';
import { uploadImages } from '../../middleware/upload';
import { asyncHandler } from '../../utils/asyncHandler';

export const brandsRouter = Router();

// NOTE: static paths (/following, /me, /admin...) must be registered before /:slug.

/**
 * @openapi
 * /brands:
 *   get:
 *     summary: List active marketplace brands (public; always empty for agents)
 *     tags: [Brands]
 *     security: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated brand cards }
 */
brandsRouter.get('/', optionalAuth, validate(brandListQuerySchema, 'query'), asyncHandler(brandsController.list));

/**
 * @openapi
 * /brands/following:
 *   get:
 *     summary: Brands I follow (BUYER only; agents get 403)
 *     tags: [Brands]
 *     responses:
 *       200: { description: Paginated brand cards }
 */
brandsRouter.get(
  '/following',
  requireAuth,
  requireBuyer,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(brandsController.following),
);

/**
 * @openapi
 * /brands/me:
 *   get:
 *     summary: My brand, including private fields (marketplace SELLER only)
 *     tags: [Brands]
 *     responses:
 *       200:
 *         description: >-
 *           Own brand. Includes effectiveCommission { first, repeat } (percent): the brand's
 *           override if set, else the platform default.
 */
brandsRouter.get('/me', requireAuth, requireMarketplaceSeller, asyncHandler(brandsController.getMine));

/**
 * @openapi
 * /brands/me:
 *   patch:
 *     summary: Update my brand profile (marketplace SELLER only; name and slug are admin-only)
 *     tags: [Brands]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Brand updated }
 */
brandsRouter.patch(
  '/me',
  requireAuth,
  requireMarketplaceSeller,
  validate(updateOwnBrandSchema),
  asyncHandler(brandsController.updateMine),
);

/**
 * @openapi
 * /brands/me/logo:
 *   post:
 *     summary: Upload a brand logo (multipart field "file"); returns the image URL
 *     tags: [Brands]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: "{ url }" }
 */
brandsRouter.post(
  '/me/logo',
  requireAuth,
  requireMarketplaceSeller,
  uploadImages.single('file'),
  asyncHandler(brandsController.uploadLogo),
);

/**
 * @openapi
 * /brands/me/banner:
 *   post:
 *     summary: Upload a brand banner (multipart field "file"); returns the image URL
 *     tags: [Brands]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: "{ url }" }
 */
brandsRouter.post(
  '/me/banner',
  requireAuth,
  requireMarketplaceSeller,
  uploadImages.single('file'),
  asyncHandler(brandsController.uploadBanner),
);

/**
 * @openapi
 * /brands/me/stats:
 *   get:
 *     summary: My brand sales dashboard numbers (marketplace SELLER only)
 *     tags: [Brands]
 *     responses:
 *       200: { description: Sales stats }
 */
brandsRouter.get('/me/stats', requireAuth, requireMarketplaceSeller, asyncHandler(brandsController.stats));

/**
 * @openapi
 * /brands/admin:
 *   get:
 *     summary: List all brands with seller contact, counts, order stats and rate overrides (SUPER_ADMIN)
 *     tags: [Brands]
 *     responses:
 *       200: { description: Paginated brands }
 */
brandsRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminBrandListQuerySchema, 'query'),
  asyncHandler(brandsController.adminList),
);

/**
 * @openapi
 * /brands/admin/commission-defaults:
 *   get:
 *     summary: Platform default commission rates (SUPER_ADMIN)
 *     tags: [Brands]
 *     responses:
 *       200: { description: "{ first, repeat }" }
 */
brandsRouter.get(
  '/admin/commission-defaults',
  requireAuth,
  requireAdmin,
  asyncHandler(brandsController.getCommissionDefaults),
);

/**
 * @openapi
 * /brands/admin/commission-defaults:
 *   put:
 *     summary: Set platform default commission rates, percent 0-100 (SUPER_ADMIN, audit-logged)
 *     tags: [Brands]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Updated defaults }
 */
brandsRouter.put(
  '/admin/commission-defaults',
  requireAuth,
  requireAdmin,
  validate(commissionDefaultsSchema),
  asyncHandler(brandsController.setCommissionDefaults),
);

/**
 * @openapi
 * /brands/admin/{id}:
 *   patch:
 *     summary: Verify, suspend, rename or override commission for a brand (SUPER_ADMIN, audit-logged)
 *     tags: [Brands]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Brand updated }
 */
brandsRouter.patch(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(adminUpdateBrandSchema),
  asyncHandler(brandsController.adminUpdate),
);

/**
 * @openapi
 * /brands/{slug}:
 *   get:
 *     summary: Public brand storefront details (404 for suspended or unknown brands)
 *     tags: [Brands]
 *     security: []
 *     responses:
 *       200: { description: Public brand }
 *       404: { description: Not found }
 */
brandsRouter.get(
  '/:slug',
  optionalAuth,
  validate(slugParamSchema, 'params'),
  asyncHandler(brandsController.getBySlug),
);

/**
 * @openapi
 * /brands/{slug}/follow:
 *   post:
 *     summary: Follow a brand (BUYER only, idempotent; agents get 403)
 *     tags: [Brands]
 *     responses:
 *       200: { description: Followed }
 */
brandsRouter.post(
  '/:slug/follow',
  requireAuth,
  requireBuyer,
  validate(slugParamSchema, 'params'),
  asyncHandler(brandsController.follow),
);

/**
 * @openapi
 * /brands/{slug}/follow:
 *   delete:
 *     summary: Unfollow a brand (BUYER only, idempotent; agents get 403)
 *     tags: [Brands]
 *     responses:
 *       200: { description: Unfollowed }
 */
brandsRouter.delete(
  '/:slug/follow',
  requireAuth,
  requireBuyer,
  validate(slugParamSchema, 'params'),
  asyncHandler(brandsController.unfollow),
);
