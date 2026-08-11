import { Router } from 'express';
import { payoutsController } from './payouts.controller';
import {
  addNotesSchema,
  adminPayoutListQuerySchema,
  idParamSchema,
  markPaidSchema,
  payoutListQuerySchema,
} from './payouts.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireSeller } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const payoutsRouter = Router();

// ── Seller ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /payouts/me:
 *   get:
 *     summary: List my payout records (SELLER only)
 *     tags: [Payouts]
 *     responses:
 *       200: { description: Payouts list }
 */
payoutsRouter.get(
  '/me',
  requireAuth,
  requireSeller,
  validate(payoutListQuerySchema, 'query'),
  asyncHandler(payoutsController.listMine),
);

/**
 * @openapi
 * /payouts/me/summary:
 *   get:
 *     summary: Get my payout dashboard summary — total earned, pending, last payout (SELLER only)
 *     tags: [Payouts]
 *     responses:
 *       200: { description: Payout summary }
 */
payoutsRouter.get(
  '/me/summary',
  requireAuth,
  requireSeller,
  asyncHandler(payoutsController.getMySummary),
);

// ── Admin ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /payouts/admin:
 *   get:
 *     summary: List all payouts (SUPER_ADMIN only)
 *     tags: [Payouts]
 *     responses:
 *       200: { description: Payouts list }
 */
payoutsRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminPayoutListQuerySchema, 'query'),
  asyncHandler(payoutsController.listAdmin),
);

/**
 * @openapi
 * /payouts/admin/{id}:
 *   get:
 *     summary: Get payout detail (SUPER_ADMIN only)
 *     tags: [Payouts]
 *     responses:
 *       200: { description: Payout detail }
 */
payoutsRouter.get(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(payoutsController.getAdmin),
);

/**
 * @openapi
 * /payouts/admin/{id}/mark-paid:
 *   post:
 *     summary: Mark a payout as paid after completing the external bank transfer (SUPER_ADMIN only)
 *     tags: [Payouts]
 *     responses:
 *       200: { description: Payout marked as paid }
 */
payoutsRouter.post(
  '/admin/:id/mark-paid',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(markPaidSchema),
  asyncHandler(payoutsController.markPaid),
);

/**
 * @openapi
 * /payouts/admin/{id}/notes:
 *   patch:
 *     summary: Add/update internal notes on a payout (SUPER_ADMIN only)
 *     tags: [Payouts]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Notes updated }
 */
payoutsRouter.patch(
  '/admin/:id/notes',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(addNotesSchema),
  asyncHandler(payoutsController.addNotes),
);
