import { AppError } from '../../utils/errors';
import { PaginationQuery } from '../../utils/pagination';
import { storageProvider } from '../../providers/storage';
import { ReviewsRepository, reviewsRepository, ReviewWithBuyer } from './reviews.repository';
import { PublicReview, SubmitReviewInput, UploadedImageFile } from './reviews.types';

const MAX_REVIEW_IMAGES = 5;

function toPublicReview(review: ReviewWithBuyer): PublicReview {
  return {
    id: review.id,
    buyerName: review.buyer.contactName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    images: review.images.map((img) => ({ id: img.id, url: img.url })),
  };
}

export class ReviewsService {
  constructor(private readonly repo: ReviewsRepository = reviewsRepository) {}

  private async uploadImages(files: UploadedImageFile[], folder: string): Promise<string[]> {
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadImage(file.buffer, `${Date.now()}-${index}-${file.originalname}`, folder),
      ),
    );
    return uploads.map((u) => u.url);
  }

  async submitReview(
    buyerId: string,
    input: SubmitReviewInput,
    files: UploadedImageFile[] = [],
  ): Promise<PublicReview> {
    if (files.length > MAX_REVIEW_IMAGES) {
      throw AppError.badRequest(`A review can include at most ${MAX_REVIEW_IMAGES} photos`);
    }

    const orderItem = await this.repo.findOrderItemForReview(input.orderItemId);
    if (!orderItem) {
      throw AppError.notFound('Order item not found');
    }
    if (orderItem.order.buyerId !== buyerId) {
      throw AppError.forbidden('You can only review items from your own orders');
    }
    if (orderItem.order.status !== 'DELIVERED') {
      throw AppError.badRequest('You can only review a product after your order has been delivered');
    }
    if (orderItem.review) {
      throw AppError.conflict('This order item has already been reviewed');
    }

    const imageUrls = files.length > 0 ? await this.uploadImages(files, `reviews/${orderItem.productId}`) : [];

    const review = await this.repo.create({
      productId: orderItem.productId,
      buyerId,
      orderItemId: input.orderItemId,
      rating: input.rating,
      comment: input.comment,
      imageUrls,
    });

    return toPublicReview(review);
  }

  async listForProduct(productId: string, pagination: PaginationQuery) {
    const [{ data, total }, summary] = await Promise.all([
      this.repo.findByProduct(productId, pagination),
      this.repo.getRatingSummary(productId),
    ]);
    return {
      data: data.map(toPublicReview),
      total,
      avgRating: summary.avgRating,
      reviewCount: summary.reviewCount,
    };
  }
}

export const reviewsService = new ReviewsService();
