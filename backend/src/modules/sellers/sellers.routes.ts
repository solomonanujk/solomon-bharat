import { Router } from 'express';
import { sellersController } from './sellers.controller';
import {
  addNoteSchema,
  applicationListQuerySchema,
  idParamSchema,
  rejectApplicationSchema,
  requestMoreInfoSchema,
  submitApplicationSchema,
  updateSellerProfileSchema,
} from './sellers.validation';
import { paginationQuerySchema } from '../../utils/pagination';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireSeller } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';

export const sellersRouter = Router();

/**
 * @openapi
 * /sellers/apply:
 *   post:
 *     summary: Submit a seller application (public)
 *     tags: [Sellers]
 *     security: []
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Application submitted }
 */
sellersRouter.post(
  '/apply',
  authRateLimiter,
  validate(submitApplicationSchema),
  asyncHandler(sellersController.submitApplication),
);

/**
 * @openapi
 * /sellers/applications:
 *   get:
 *     summary: List seller applications (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Applications list }
 */
sellersRouter.get(
  '/applications',
  requireAuth,
  requireAdmin,
  validate(applicationListQuerySchema, 'query'),
  asyncHandler(sellersController.listApplications),
);

/**
 * @openapi
 * /sellers/applications/{id}:
 *   get:
 *     summary: Get seller application detail (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Application detail }
 */
sellersRouter.get(
  '/applications/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(sellersController.getApplication),
);

/**
 * @openapi
 * /sellers/applications/{id}/approve:
 *   post:
 *     summary: Approve a seller application — creates the SELLER account (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Application approved }
 */
sellersRouter.post(
  '/applications/:id/approve',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(sellersController.approveApplication),
);

/**
 * @openapi
 * /sellers/applications/{id}/reject:
 *   post:
 *     summary: Reject a seller application (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Application rejected }
 */
sellersRouter.post(
  '/applications/:id/reject',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(rejectApplicationSchema),
  asyncHandler(sellersController.rejectApplication),
);

/**
 * @openapi
 * /sellers/applications/{id}/request-info:
 *   post:
 *     summary: Request more information from an applicant (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: More information requested }
 */
sellersRouter.post(
  '/applications/:id/request-info',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(requestMoreInfoSchema),
  asyncHandler(sellersController.requestMoreInfo),
);

/**
 * @openapi
 * /sellers/applications/{id}/notes:
 *   post:
 *     summary: Add an internal note to a seller application (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Note added }
 */
sellersRouter.post(
  '/applications/:id/notes',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(addNoteSchema),
  asyncHandler(sellersController.addNote),
);

/**
 * @openapi
 * /sellers/me:
 *   get:
 *     summary: Get my own seller profile (SELLER only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Seller profile }
 */
sellersRouter.get('/me', requireAuth, requireSeller, asyncHandler(sellersController.getMyProfile));

/**
 * @openapi
 * /sellers/me:
 *   patch:
 *     summary: Update my own seller profile (SELLER only)
 *     tags: [Sellers]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Profile updated }
 */
sellersRouter.patch(
  '/me',
  requireAuth,
  requireSeller,
  validate(updateSellerProfileSchema),
  asyncHandler(sellersController.updateMyProfile),
);

/**
 * @openapi
 * /sellers:
 *   get:
 *     summary: List approved sellers (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Sellers list }
 */
sellersRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(sellersController.listSellers),
);

/**
 * @openapi
 * /sellers/{id}:
 *   get:
 *     summary: Get seller detail (SUPER_ADMIN only)
 *     tags: [Sellers]
 *     responses:
 *       200: { description: Seller detail }
 */
sellersRouter.get(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(sellersController.getSeller),
);
