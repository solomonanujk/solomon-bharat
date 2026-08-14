import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buyersService } from '../buyers/buyers.service';
import { reviewsService } from './reviews.service';
import { ListReviewsQueryDto, SubmitReviewDto } from './reviews.validation';

async function resolveBuyerProfileId(userId: string): Promise<string> {
  const profile = await buyersService.getMyProfile(userId);
  return profile.id;
}

function extractFiles(req: Request) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  return files.map((f) => ({ buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype }));
}

export const reviewsController = {
  async submit(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as SubmitReviewDto;
    const review = await reviewsService.submitReview(buyerId, dto, extractFiles(req));
    sendCreated(res, review, 'Review submitted');
  },

  async listForProduct(req: Request, res: Response): Promise<void> {
    const { productId, ...pagination } = req.query as unknown as ListReviewsQueryDto;
    const result = await reviewsService.listForProduct(productId, pagination);
    sendSuccess(res, { items: result.data, avgRating: result.avgRating, reviewCount: result.reviewCount }, 'Reviews retrieved', 200, {
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(result.total / pagination.limit)),
    });
  },
};
