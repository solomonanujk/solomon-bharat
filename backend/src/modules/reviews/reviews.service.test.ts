import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewsRepository, OrderItemForReview } from './reviews.repository';
import { ReviewsService } from './reviews.service';

vi.mock('../../providers/storage', () => ({
  storageProvider: {
    uploadImage: vi.fn().mockImplementation((_buf: Buffer, name: string) =>
      Promise.resolve({ url: `https://cdn.example.com/reviews/${name}`, publicId: name }),
    ),
  },
}));

import { storageProvider } from '../../providers/storage';

const oneFile = { buffer: Buffer.from('a'), originalname: 'photo.jpg', mimetype: 'image/jpeg' };

function buildOrderItem(overrides: Partial<OrderItemForReview> = {}): OrderItemForReview {
  return {
    id: 'item-1',
    orderId: 'order-1',
    productId: 'prod-1',
    sellerId: 'seller-1',
    quantity: 2,
    unitAdminPrice: 0 as never,
    unitSellerPrice: 0 as never,
    lineAdminTotal: 0 as never,
    lineSellerTotal: 0 as never,
    createdAt: new Date(),
    order: { buyerId: 'buyer-1', status: 'DELIVERED' },
    review: null,
    ...overrides,
  } as OrderItemForReview;
}

function buildMockRepo(): ReviewsRepository {
  return {
    findOrderItemForReview: vi.fn(),
    create: vi.fn(),
    findByProduct: vi.fn(),
    getRatingSummary: vi.fn(),
    getRatingSummaries: vi.fn(),
  } as unknown as ReviewsRepository;
}

describe('ReviewsService', () => {
  let repo: ReviewsRepository;
  let service: ReviewsService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new ReviewsService(repo);
  });

  describe('submitReview', () => {
    it('rejects when the order item does not exist', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(null);

      await expect(
        service.submitReview('buyer-1', { orderItemId: 'missing', rating: 5 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rejects reviewing an order item that belongs to another buyer', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(
        buildOrderItem({ order: { buyerId: 'someone-else', status: 'DELIVERED' } }),
      );

      await expect(
        service.submitReview('buyer-1', { orderItemId: 'item-1', rating: 5 }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects reviewing before the order is delivered', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(
        buildOrderItem({ order: { buyerId: 'buyer-1', status: 'IN_TRANSIT' } }),
      );

      await expect(
        service.submitReview('buyer-1', { orderItemId: 'item-1', rating: 5 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects a second review of the same order item', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(
        buildOrderItem({ review: { id: 'existing-review' } }),
      );

      await expect(
        service.submitReview('buyer-1', { orderItemId: 'item-1', rating: 5 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('creates a review tied to the order item\'s product for a delivered, unreviewed, owned item', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(buildOrderItem());
      vi.mocked(repo.create).mockResolvedValue({
        id: 'review-1',
        productId: 'prod-1',
        buyerId: 'buyer-1',
        orderItemId: 'item-1',
        rating: 4,
        comment: 'Great quality',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        buyer: { contactName: 'Alex Morgan' },
        images: [],
      } as never);

      const result = await service.submitReview('buyer-1', {
        orderItemId: 'item-1',
        rating: 4,
        comment: 'Great quality',
      });

      expect(repo.create).toHaveBeenCalledWith({
        productId: 'prod-1',
        buyerId: 'buyer-1',
        orderItemId: 'item-1',
        rating: 4,
        comment: 'Great quality',
        imageUrls: [],
      });
      expect(result).toEqual({
        id: 'review-1',
        buyerName: 'Alex Morgan',
        rating: 4,
        comment: 'Great quality',
        createdAt: new Date('2026-01-01'),
        images: [],
      });
      // Never leaks buyerId/orderItemId/productId to the public shape
      expect(result).not.toHaveProperty('buyerId');
    });

    it('uploads optional photos and attaches their URLs to the review', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(buildOrderItem());
      vi.mocked(repo.create).mockResolvedValue({
        id: 'review-1',
        buyerId: 'buyer-1',
        orderItemId: 'item-1',
        rating: 5,
        comment: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        buyer: { contactName: 'Alex Morgan' },
        images: [{ id: 'img-1', reviewId: 'review-1', url: 'https://cdn.example.com/reviews/0-photo.jpg', sortOrder: 0 }],
      } as never);

      const result = await service.submitReview('buyer-1', { orderItemId: 'item-1', rating: 5 }, [oneFile]);

      expect(storageProvider.uploadImage).toHaveBeenCalledWith(oneFile.buffer, expect.stringContaining('photo.jpg'), 'reviews');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrls: [expect.stringContaining('reviews/')] }),
      );
      expect(result.images).toEqual([{ id: 'img-1', url: 'https://cdn.example.com/reviews/0-photo.jpg' }]);
    });

    it('rejects more than 5 review photos', async () => {
      vi.mocked(repo.findOrderItemForReview).mockResolvedValue(buildOrderItem());

      await expect(
        service.submitReview('buyer-1', { orderItemId: 'item-1', rating: 5 }, Array(6).fill(oneFile)),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('listForProduct', () => {
    it('combines the paginated list with the aggregate rating summary', async () => {
      vi.mocked(repo.findByProduct).mockResolvedValue({
        data: [
          {
            id: 'r1', productId: 'prod-1', buyerId: 'b1', orderItemId: 'i1', rating: 5, comment: null,
            createdAt: new Date(), updatedAt: new Date(), buyer: { contactName: 'Jordan Lee' },
            images: [{ id: 'img-1', reviewId: 'r1', url: 'https://cdn.example.com/reviews/a.jpg', sortOrder: 0 }],
          },
        ],
        total: 1,
      } as never);
      vi.mocked(repo.getRatingSummary).mockResolvedValue({ avgRating: 4.5, reviewCount: 2 });

      const result = await service.listForProduct('prod-1', { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.avgRating).toBe(4.5);
      expect(result.reviewCount).toBe(2);
      expect(result.data[0]).toEqual({
        id: 'r1', buyerName: 'Jordan Lee', rating: 5, comment: null, createdAt: result.data[0].createdAt,
        images: [{ id: 'img-1', url: 'https://cdn.example.com/reviews/a.jpg' }],
      });
    });
  });
});
