import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { checkoutSchema, fxRateQuerySchema, idParamSchema, orderIdParamSchema } from './payments.validation';
import { validate } from '../../middleware/validate';
import { requireAuth, requireBuyer } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const paymentsRouter = Router();

/**
 * @openapi
 * /payments/fx-rates:
 *   get:
 *     summary: Server-authoritative INR→currency rate, consulted right before checkout (any authenticated buyer)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Current cached FX rate }
 */
paymentsRouter.get(
  '/fx-rates',
  requireAuth,
  requireBuyer,
  validate(fxRateQuerySchema, 'query'),
  asyncHandler(paymentsController.getFxRate),
);

/**
 * @openapi
 * /payments/checkout:
 *   post:
 *     summary: Create an order from cart items and start PayPal checkout (BUYER only)
 *     tags: [Payments]
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Checkout created — approve payment to complete the order }
 */
paymentsRouter.post(
  '/checkout',
  requireAuth,
  requireBuyer,
  validate(checkoutSchema),
  asyncHandler(paymentsController.checkout),
);

/**
 * @openapi
 * /payments/{id}/capture:
 *   post:
 *     summary: Capture an approved PayPal payment, marking the order PAYMENT_RECEIVED (BUYER only)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Payment captured or failed }
 */
paymentsRouter.post(
  '/:id/capture',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  asyncHandler(paymentsController.capture),
);

/**
 * @openapi
 * /payments/{id}:
 *   get:
 *     summary: Get payment status (BUYER, own only)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Payment detail }
 */
paymentsRouter.get(
  '/:id',
  requireAuth,
  requireBuyer,
  validate(idParamSchema, 'params'),
  asyncHandler(paymentsController.getStatus),
);

/**
 * @openapi
 * /payments/orders/{orderId}/invoice:
 *   get:
 *     summary: Get the invoice for an order (BUYER own order, or SUPER_ADMIN any order)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Invoice }
 */
paymentsRouter.get(
  '/orders/:orderId/invoice',
  requireAuth,
  validate(orderIdParamSchema, 'params'),
  asyncHandler(paymentsController.getInvoice),
);
