import { Router } from 'express';
import { reviewsController } from './reviews.controller';
import { listReviewsQuerySchema, submitReviewSchema } from './reviews.validation';
import { validate } from '../../middleware/validate';
import { requireAuth, requireBuyer } from '../../middleware/auth';
import { uploadImages } from '../../middleware/upload';
import { asyncHandler } from '../../utils/asyncHandler';

export const reviewsRouter = Router();

const reviewPhotosUpload = uploadImages.array('images', 5);

/**
 * @openapi
 * /reviews:
 *   post:
 *     summary: Submit a review for a delivered order item (BUYER only, one per order item, up to 5 optional photos)
 *     tags: [Reviews]
 *     responses:
 *       201: { description: Review created }
 *   get:
 *     summary: List reviews for a product, with the aggregate rating (public)
 *     tags: [Reviews]
 *     responses:
 *       200: { description: Paginated reviews + avgRating/reviewCount }
 */
reviewsRouter.post(
  '/',
  requireAuth,
  requireBuyer,
  reviewPhotosUpload,
  validate(submitReviewSchema),
  asyncHandler(reviewsController.submit),
);

reviewsRouter.get(
  '/',
  validate(listReviewsQuerySchema, 'query'),
  asyncHandler(reviewsController.listForProduct),
);
