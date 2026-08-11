import { Router } from 'express';
import { ordersController } from './orders.controller';
import {
  adminOrderListQuerySchema,
  cancelOrderSchema,
  exportDocumentsSchema,
  idParamSchema,
  procureSchema,
  shipSchema,
  trackingSchema,
} from './orders.validation';
import { paginationQuerySchema } from '../../utils/pagination';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireBuyer, requireSeller } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const ordersRouter = Router();

// ── Buyer ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/me:
 *   get:
 *     summary: List my orders (BUYER only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Orders list }
 */
ordersRouter.get(
  '/me',
  requireAuth,
  requireBuyer,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(ordersController.listMine),
);

/**
 * @openapi
 * /orders/me/{id}:
 *   get:
 *     summary: Get one of my own orders (BUYER only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order detail }
 */
ordersRouter.get(
  '/me/:id',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  asyncHandler(ordersController.getMine),
);

// ── Seller ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/seller/items:
 *   get:
 *     summary: List order items linked to my products (SELLER only, no buyer info)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order items list }
 */
ordersRouter.get(
  '/seller/items',
  requireAuth,
  requireSeller,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(ordersController.listSellerItems),
);

// ── Admin ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/admin:
 *   get:
 *     summary: List all orders (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Orders list }
 */
ordersRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminOrderListQuerySchema, 'query'),
  asyncHandler(ordersController.listAdmin),
);

/**
 * @openapi
 * /orders/admin/{id}:
 *   get:
 *     summary: Get full order detail (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order detail }
 */
ordersRouter.get(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(ordersController.getAdmin),
);

/**
 * @openapi
 * /orders/admin/{id}/confirm:
 *   post:
 *     summary: Confirm a paid order (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order confirmed }
 */
ordersRouter.post(
  '/admin/:id/confirm',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(ordersController.confirm),
);

/**
 * @openapi
 * /orders/admin/{id}/procure:
 *   post:
 *     summary: Move a confirmed order to procuring, optionally setting an expected collection date (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order moved to procuring }
 */
ordersRouter.post(
  '/admin/:id/procure',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(procureSchema),
  asyncHandler(ordersController.procure),
);

/**
 * @openapi
 * /orders/admin/{id}/collect:
 *   post:
 *     summary: Mark goods as collected from the seller (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order marked as collected }
 */
ordersRouter.post(
  '/admin/:id/collect',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(ordersController.collect),
);

/**
 * @openapi
 * /orders/admin/{id}/ship:
 *   post:
 *     summary: Mark goods as in transit, optionally setting a tracking number (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order marked as in transit }
 */
ordersRouter.post(
  '/admin/:id/ship',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(shipSchema),
  asyncHandler(ordersController.ship),
);

/**
 * @openapi
 * /orders/admin/{id}/deliver:
 *   post:
 *     summary: Mark an order as delivered (SUPER_ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200: { description: Order marked as delivered }
 */
ordersRouter.post(
  '/admin/:id/deliver',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(ordersController.deliver),
);

/**
 * @openapi
 * /orders/admin/{id}/cancel:
 *   post:
 *     summary: Cancel an order before fulfillment begins (SUPER_ADMIN only)
 *     tags: [Orders]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Order cancelled }
 */
ordersRouter.post(
  '/admin/:id/cancel',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(cancelOrderSchema),
  asyncHandler(ordersController.cancel),
);

/**
 * @openapi
 * /orders/admin/{id}/tracking:
 *   patch:
 *     summary: Update the tracking number on an order (SUPER_ADMIN only)
 *     tags: [Orders]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Tracking number updated }
 */
ordersRouter.patch(
  '/admin/:id/tracking',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(trackingSchema),
  asyncHandler(ordersController.setTracking),
);

/**
 * @openapi
 * /orders/admin/{id}/export-documents:
 *   post:
 *     summary: Attach export/shipping documents to an order (SUPER_ADMIN only)
 *     tags: [Orders]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Export documents attached }
 */
ordersRouter.post(
  '/admin/:id/export-documents',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(exportDocumentsSchema),
  asyncHandler(ordersController.setExportDocuments),
);
