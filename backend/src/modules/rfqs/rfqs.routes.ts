import { Router } from 'express';
import { requireAdmin, requireAuth, requireBuyerOrAgent } from '../../middleware/auth';
import { uploadImages } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { paginationQuerySchema } from '../../utils/pagination';
import { rfqsController } from './rfqs.controller';
import { MAX_RFQ_IMAGES } from './rfqs.service';
import { adminRfqListQuerySchema, createRfqSchema, idParamSchema, updateRfqSchema } from './rfqs.validation';

export const rfqsRouter = Router();

/**
 * @openapi
 * /rfqs:
 *   post:
 *     summary: Submit a custom requirement (multipart, up to 5 'images'). BUYER or AGENT
 *     tags: [RFQs]
 */
rfqsRouter.post(
  '/',
  requireAuth,
  requireBuyerOrAgent,
  uploadImages.array('images', MAX_RFQ_IMAGES),
  validate(createRfqSchema),
  asyncHandler(rfqsController.create),
);

/**
 * @openapi
 * /rfqs/me:
 *   get:
 *     summary: My custom requirements. BUYER or AGENT
 *     tags: [RFQs]
 */
rfqsRouter.get(
  '/me',
  requireAuth,
  requireBuyerOrAgent,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(rfqsController.listMine),
);

/**
 * @openapi
 * /rfqs/admin:
 *   get:
 *     summary: All custom requirements, filterable by status (SUPER_ADMIN only)
 *     tags: [RFQs]
 */
rfqsRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  validate(adminRfqListQuerySchema, 'query'),
  asyncHandler(rfqsController.listAdmin),
);

/**
 * @openapi
 * /rfqs/admin/{id}:
 *   patch:
 *     summary: Update a request's status or internal notes (SUPER_ADMIN only)
 *     tags: [RFQs]
 */
rfqsRouter.patch(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(updateRfqSchema),
  asyncHandler(rfqsController.update),
);
