import { OrderItem, PrismaClient, Review, ReviewImage } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';

export type OrderItemForReview = OrderItem & {
  order: { buyerId: string; status: string };
  review: { id: string } | null;
};

export type ReviewWithBuyer = Review & { buyer: { contactName: string }; images: ReviewImage[] };

const REVIEW_INCLUDE = {
  buyer: { select: { contactName: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
};

export class ReviewsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findOrderItemForReview(orderItemId: string): Promise<OrderItemForReview | null> {
    return this.db.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: { select: { buyerId: true, status: true } },
        review: { select: { id: true } },
      },
    });
  }

  create(input: {
    productId: string;
    buyerId: string;
    orderItemId: string;
    rating: number;
    comment?: string;
    imageUrls: string[];
  }): Promise<ReviewWithBuyer> {
    return this.db.review.create({
      data: {
        productId: input.productId,
        buyerId: input.buyerId,
        orderItemId: input.orderItemId,
        rating: input.rating,
        comment: input.comment,
        images: { create: input.imageUrls.map((url, index) => ({ url, sortOrder: index })) },
      },
      include: REVIEW_INCLUDE,
    });
  }

  async findByProduct(productId: string, pagination: PaginationQuery): Promise<{ data: ReviewWithBuyer[]; total: number }> {
    const where = { productId };
    const [data, total] = await Promise.all([
      this.db.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.review.count({ where }),
    ]);
    return { data, total };
  }

  async getRatingSummary(productId: string): Promise<{ avgRating: number | null; reviewCount: number }> {
    const result = await this.db.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    return { avgRating: result._avg.rating, reviewCount: result._count };
  }

  /** Batch version for product list pages — one query instead of N. */
  async getRatingSummaries(productIds: string[]): Promise<Map<string, { avgRating: number; reviewCount: number }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.db.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: true,
    });
    return new Map(
      rows.map((r) => [r.productId, { avgRating: r._avg.rating ?? 0, reviewCount: r._count }]),
    );
  }
}

export const reviewsRepository = new ReviewsRepository();
