import { Router } from 'express';
import { buyersController } from './buyers.controller';
import {
  addWishlistItemSchema,
  adminListQuerySchema,
  createAddressSchema,
  idParamSchema,
  productIdParamSchema,
  sendMessageSchema,
  updateAddressSchema,
  updateBuyerProfileSchema,
} from './buyers.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireBuyer } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const buyersRouter = Router();

// ── Buyer: profile ─────────────────────────────────────────────────────

/**
 * @openapi
 * /buyers/me:
 *   get:
 *     summary: Get my buyer profile (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Buyer profile }
 */
buyersRouter.get('/me', requireAuth, requireBuyer, asyncHandler(buyersController.getMyProfile));

/**
 * @openapi
 * /buyers/me:
 *   patch:
 *     summary: Update my buyer profile (BUYER only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Profile updated }
 */
buyersRouter.patch(
  '/me',
  requireAuth,
  requireBuyer,
  validate(updateBuyerProfileSchema),
  asyncHandler(buyersController.updateMyProfile),
);

// ── Buyer: addresses ────────────────────────────────────────────────────

/**
 * @openapi
 * /buyers/me/addresses:
 *   get:
 *     summary: List my addresses (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Addresses list }
 */
buyersRouter.get(
  '/me/addresses',
  requireAuth,
  requireBuyer,
  asyncHandler(buyersController.listAddresses),
);

/**
 * @openapi
 * /buyers/me/addresses:
 *   post:
 *     summary: Add an address (BUYER only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Address added }
 */
buyersRouter.post(
  '/me/addresses',
  requireAuth,
  requireBuyer,
  validate(createAddressSchema),
  asyncHandler(buyersController.createAddress),
);

/**
 * @openapi
 * /buyers/me/addresses/{id}:
 *   patch:
 *     summary: Update an address (BUYER only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Address updated }
 */
buyersRouter.patch(
  '/me/addresses/:id',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  validate(updateAddressSchema),
  asyncHandler(buyersController.updateAddress),
);

/**
 * @openapi
 * /buyers/me/addresses/{id}:
 *   delete:
 *     summary: Delete an address (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Address deleted }
 */
buyersRouter.delete(
  '/me/addresses/:id',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  asyncHandler(buyersController.deleteAddress),
);

/**
 * @openapi
 * /buyers/me/addresses/{id}/default:
 *   post:
 *     summary: Set an address as default (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Default address updated }
 */
buyersRouter.post(
  '/me/addresses/:id/default',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  asyncHandler(buyersController.setDefaultAddress),
);

// ── Buyer: wishlist ─────────────────────────────────────────────────────

/**
 * @openapi
 * /buyers/me/wishlist:
 *   get:
 *     summary: List my wishlist (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Wishlist items }
 */
buyersRouter.get('/me/wishlist', requireAuth, requireBuyer, asyncHandler(buyersController.listWishlist));

/**
 * @openapi
 * /buyers/me/wishlist:
 *   post:
 *     summary: Add a product to my wishlist (BUYER only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Added to wishlist }
 */
buyersRouter.post(
  '/me/wishlist',
  requireAuth,
  requireBuyer,
  validate(addWishlistItemSchema),
  asyncHandler(buyersController.addToWishlist),
);

/**
 * @openapi
 * /buyers/me/wishlist/{productId}:
 *   delete:
 *     summary: Remove a product from my wishlist (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Removed from wishlist }
 */
buyersRouter.delete(
  '/me/wishlist/:productId',
  requireAuth,
  requireBuyer,
  validate(productIdParamSchema, 'params'),
  asyncHandler(buyersController.removeFromWishlist),
);

// ── Buyer: messages (with Solomon Bharat admin only) ─────────────────────

/**
 * @openapi
 * /buyers/me/messages:
 *   get:
 *     summary: Get my conversation with Solomon Bharat (BUYER only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Messages }
 */
buyersRouter.get('/me/messages', requireAuth, requireBuyer, asyncHandler(buyersController.getMyMessages));

/**
 * @openapi
 * /buyers/me/messages:
 *   post:
 *     summary: Send a message to Solomon Bharat (BUYER only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Message sent }
 */
buyersRouter.post(
  '/me/messages',
  requireAuth,
  requireBuyer,
  validate(sendMessageSchema),
  asyncHandler(buyersController.sendMyMessage),
);

// ── Admin ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /buyers/admin:
 *   get:
 *     summary: List buyers (SUPER_ADMIN only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Buyers list }
 */
buyersRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminListQuerySchema, 'query'),
  asyncHandler(buyersController.listBuyersAdmin),
);

/**
 * @openapi
 * /buyers/admin/{id}:
 *   get:
 *     summary: Get buyer detail (SUPER_ADMIN only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Buyer detail }
 */
buyersRouter.get(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(buyersController.getBuyerAdmin),
);

/**
 * @openapi
 * /buyers/admin/{id}/messages:
 *   get:
 *     summary: View a buyer's conversation (SUPER_ADMIN only)
 *     tags: [Buyers]
 *     responses:
 *       200: { description: Messages }
 */
buyersRouter.get(
  '/admin/:id/messages',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(buyersController.getConversationAdmin),
);

/**
 * @openapi
 * /buyers/admin/{id}/messages:
 *   post:
 *     summary: Reply to a buyer (SUPER_ADMIN only)
 *     tags: [Buyers]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Message sent }
 */
buyersRouter.post(
  '/admin/:id/messages',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(sendMessageSchema),
  asyncHandler(buyersController.sendMessageAdmin),
);
