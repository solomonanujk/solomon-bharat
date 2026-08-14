import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Product, ProductApprovalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/prisma';
import { buildMockCache } from '../../test-utils/mockCache';
import { CategoriesService } from '../categories/categories.service';
import { ReviewsRepository } from '../reviews/reviews.repository';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';
import { ProductWithMedia } from './products.types';

vi.mock('../../providers/storage', () => ({
  storageProvider: {
    uploadImage: vi.fn().mockImplementation((_buf: Buffer, name: string) =>
      Promise.resolve({ url: `https://cdn.example.com/${name}`, publicId: name }),
    ),
  },
}));

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/prisma', () => ({
  prisma: {
    sellerProfile: { findUnique: vi.fn().mockResolvedValue({ userId: 'seller-user-1' }) },
    wishlistItem: { findMany: vi.fn().mockResolvedValue([]) },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifyProductApproved: vi.fn().mockResolvedValue(undefined),
    notifyProductRejected: vi.fn().mockResolvedValue(undefined),
  },
}));

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sellerId: 'seller-1',
    categoryId: 'cat-l3-1',
    name: 'Table Runner',
    slug: 'table-runner',
    description: 'Handwoven table runner',
    materials: 'Cotton',
    dimensions: null,
    weight: null,
    moq: 10,
    declaredStock: 100,
    sellerPrice: new Decimal(5),
    adminPrice: null,
    leadTime: null,
    certifications: null,
    approvalStatus: ProductApprovalStatus.PENDING,
    rejectionReason: null,
    isPublished: false,
    isFeatured: false,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function withMedia(product: Product): ProductWithMedia {
  return { ...product, images: [], variants: [] };
}

function buildMockRepo(): ProductsRepository {
  return {
    findByIdWithMedia: vi.fn(),
    findByIdRaw: vi.fn(),
    findBySlugWithMedia: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    update: vi.fn(),
    setApproval: vi.fn(),
    setCategory: vi.fn(),
    setPublished: vi.fn(),
    setFeatured: vi.fn(),
    softDelete: vi.fn(),
    findPublished: vi.fn(),
    findRecommended: vi.fn(),
    findRelated: vi.fn(),
    findForSeller: vi.fn(),
    findForAdmin: vi.fn(),
  } as unknown as ProductsRepository;
}

function buildMockCategories(): CategoriesService {
  return {
    assertValidLeafCategory: vi.fn().mockResolvedValue({ id: 'cat-l3-1', level: 3 }),
    getLeafDescendantIds: vi.fn().mockResolvedValue(['cat-l3-1']),
  } as unknown as CategoriesService;
}

function buildMockReviews(): ReviewsRepository {
  return {
    getRatingSummaries: vi.fn().mockResolvedValue(new Map()),
  } as unknown as ReviewsRepository;
}

const twoFiles = [
  { buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
  { buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg' },
];

describe('ProductsService', () => {
  let repo: ProductsRepository;
  let categories: CategoriesService;
  let service: ProductsService;

  beforeEach(() => {
    repo = buildMockRepo();
    categories = buildMockCategories();
    service = new ProductsService(repo, categories, buildMockCache(), buildMockReviews());
  });

  describe('createProduct', () => {
    it('rejects fewer than 2 images', async () => {
      await expect(
        service.createProduct(
          'seller-1',
          {
            name: 'X',
            description: 'Y',
            categoryId: 'cat-l3-1',
            materials: 'Cotton',
            moq: 1,
            declaredStock: 1,
            sellerPrice: 1,
          },
          [twoFiles[0]],
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a category that is not a valid level-3 leaf', async () => {
      vi.mocked(categories.assertValidLeafCategory).mockRejectedValue(
        Object.assign(new Error('not level 3'), { statusCode: 400 }),
      );

      await expect(
        service.createProduct(
          'seller-1',
          {
            name: 'X',
            description: 'Y',
            categoryId: 'cat-l1',
            materials: 'Cotton',
            moq: 1,
            declaredStock: 1,
            sellerPrice: 1,
          },
          twoFiles,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('uploads images and creates the product on valid input', async () => {
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct()));

      const result = await service.createProduct(
        'seller-1',
        {
          name: 'Table Runner',
          description: 'Handwoven',
          categoryId: 'cat-l3-1',
          materials: 'Cotton',
          moq: 10,
          declaredStock: 100,
          sellerPrice: 5,
        },
        twoFiles,
      );

      expect(repo.create).toHaveBeenCalledWith(
        'seller-1',
        expect.objectContaining({ name: 'Table Runner' }),
        expect.arrayContaining([expect.stringContaining('https://cdn.example.com/')]),
      );
      // seller projection must never leak adminPrice
      expect(result).not.toHaveProperty('adminPrice');
      expect(result.sellerPrice).toBe('5');
    });
  });

  describe('updateProduct', () => {
    it('blocks editing an already-approved product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED }),
      );

      await expect(
        service.updateProduct('seller-1', 'prod-1', { name: 'New name' }, []),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('blocks editing a product owned by a different seller', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct({ sellerId: 'someone-else' }));

      await expect(
        service.updateProduct('seller-1', 'prod-1', { name: 'New name' }, []),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects an image count outside 2-10 after applying add/remove', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...withMedia(buildProduct()),
        images: [{ id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 }],
      });

      await expect(
        service.updateProduct('seller-1', 'prod-1', { removeImageIds: ['img-1'] }, []),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('resubmitProduct', () => {
    it('only allows resubmitting a rejected product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.PENDING }),
      );

      await expect(service.resubmitProduct('seller-1', 'prod-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('clears the rejection reason and moves to RESUBMITTED', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.REJECTED, rejectionReason: 'blurry photos' }),
      );
      vi.mocked(repo.setApproval).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.RESUBMITTED }),
      );
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(
        withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.RESUBMITTED })),
      );

      await service.resubmitProduct('seller-1', 'prod-1');

      expect(repo.setApproval).toHaveBeenCalledWith('prod-1', {
        approvalStatus: ProductApprovalStatus.RESUBMITTED,
        rejectionReason: null,
      });
    });
  });

  describe('approveProduct / rejectProduct', () => {
    it('rejects approving a product that is already approved', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED }),
      );

      await expect(service.approveProduct('prod-1', 100, 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('approving sets adminPrice, publishes, and stamps publishedAt', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.setApproval).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED, isPublished: true }),
      );

      await service.approveProduct('prod-1', 42, 'admin-1');

      expect(repo.setApproval).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({
          approvalStatus: ProductApprovalStatus.APPROVED,
          adminPrice: 42,
          isPublished: true,
        }),
      );
    });

    it('rejecting a resubmitted product is allowed and keeps it unpublished', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.RESUBMITTED }),
      );
      vi.mocked(repo.setApproval).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.REJECTED }),
      );

      await service.rejectProduct('prod-1', 'still not right', 'admin-1');

      expect(repo.setApproval).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({ approvalStatus: ProductApprovalStatus.REJECTED, isPublished: false }),
      );
    });
  });

  describe('updatePrice', () => {
    it('rejects updating price on a product that was never approved', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());

      await expect(service.updatePrice('prod-1', 50, 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('setPublished', () => {
    it('refuses to publish a product with no admin price set', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED, adminPrice: null }),
      );

      await expect(service.setPublished('prod-1', true)).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('listPublished', () => {
    it('rejects a search with neither category nor collection scope (400, per AGENTS.md)', async () => {
      await expect(service.listPublished({}, { page: 1, limit: 20 })).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.findPublished).not.toHaveBeenCalled();
    });

    it('resolves a category id to its leaf descendants before querying', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [], total: 0 });

      await service.listPublished({ categoryId: 'cat-l1' }, { page: 1, limit: 20 });

      expect(categories.getLeafDescendantIds).toHaveBeenCalledWith('cat-l1');
      expect(repo.findPublished).toHaveBeenCalledWith(
        { categoryId: 'cat-l1' },
        { page: 1, limit: 20 },
        ['cat-l3-1'],
      );
    });

    it('never leaks sellerPrice or sellerId in the buyer projection', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({
        data: [withMedia(buildProduct({ adminPrice: new Decimal(20) }))],
        total: 1,
      });

      const { data } = await service.listPublished({ categoryId: 'cat-l1' }, { page: 1, limit: 20 });

      expect(data[0]).not.toHaveProperty('sellerPrice');
      expect(data[0]).not.toHaveProperty('sellerId');
      expect(data[0]).not.toHaveProperty('declaredStock');
      expect(data[0].adminPrice).toBe('20');
    });
  });

  describe('getRecommendationsForBuyer', () => {
    it('derives preferred categories from wishlist + order history and passes them to the repository', async () => {
      vi.mocked(prisma.wishlistItem.findMany).mockResolvedValue([
        { product: { categoryId: 'cat-wishlisted' } },
      ] as never);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        { product: { categoryId: 'cat-ordered' } },
        { product: { categoryId: 'cat-wishlisted' } },
      ] as never);
      vi.mocked(repo.findRecommended).mockResolvedValue({
        data: [withMedia(buildProduct({ isPublished: true, approvalStatus: ProductApprovalStatus.APPROVED }))],
        total: 1,
      });

      const { data, total } = await service.getRecommendationsForBuyer('buyer-1', { page: 1, limit: 20 });

      expect(repo.findRecommended).toHaveBeenCalledWith(
        expect.arrayContaining(['cat-wishlisted', 'cat-ordered']),
        { page: 1, limit: 20 },
      );
      expect(repo.findRecommended).toHaveBeenCalledWith(
        expect.arrayContaining([]),
        expect.anything(),
      );
      expect((repo.findRecommended as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(2);
      expect(total).toBe(1);
      expect(data[0]).not.toHaveProperty('sellerPrice');
    });

    it('falls back to an empty preferred-category list when the buyer has no history', async () => {
      vi.mocked(prisma.wishlistItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);
      vi.mocked(repo.findRecommended).mockResolvedValue({ data: [], total: 0 });

      await service.getRecommendationsForBuyer('buyer-2', { page: 1, limit: 20 });

      expect(repo.findRecommended).toHaveBeenCalledWith([], { page: 1, limit: 20 });
    });
  });

  describe('listForSeller', () => {
    it('never leaks adminPrice or margin in the seller projection', async () => {
      vi.mocked(repo.findForSeller).mockResolvedValue({
        data: [withMedia(buildProduct({ adminPrice: new Decimal(99) }))],
        total: 1,
      });

      const { data } = await service.listForSeller('seller-1', {}, { page: 1, limit: 20 });

      expect(data[0]).not.toHaveProperty('adminPrice');
      expect(data[0]).not.toHaveProperty('margin');
    });
  });

  describe('updateProduct (success path)', () => {
    it('applies the update once the image count stays within 2-10', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...withMedia(buildProduct()),
        images: [
          { id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 },
          { id: 'img-2', productId: 'prod-1', url: 'y', sortOrder: 1 },
        ],
      });
      vi.mocked(repo.update).mockResolvedValue(withMedia(buildProduct({ name: 'Updated Name' })));

      const result = await service.updateProduct('seller-1', 'prod-1', { name: 'Updated Name' }, []);

      expect(repo.update).toHaveBeenCalledWith('prod-1', { name: 'Updated Name' }, [], 2);
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteProduct', () => {
    it('rejects deleting a product owned by a different seller', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct({ sellerId: 'someone-else' }));

      await expect(service.deleteProduct('seller-1', 'prod-1')).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes a product owned by the seller', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());

      await service.deleteProduct('seller-1', 'prod-1');

      expect(repo.softDelete).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('reassignCategory', () => {
    it('validates the new category is a level-3 leaf before reassigning', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.setCategory).mockResolvedValue(buildProduct({ categoryId: 'cat-l3-2' }));

      await service.reassignCategory('prod-1', 'cat-l3-2', 'admin-1');

      expect(categories.assertValidLeafCategory).toHaveBeenCalledWith('cat-l3-2');
      expect(repo.setCategory).toHaveBeenCalledWith('prod-1', 'cat-l3-2');
    });
  });

  describe('setFeatured', () => {
    it('toggles the featured flag', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.setFeatured).mockResolvedValue(buildProduct({ isFeatured: true }));

      const result = await service.setFeatured('prod-1', true);

      expect(repo.setFeatured).toHaveBeenCalledWith('prod-1', true);
      expect(result.isFeatured).toBe(true);
    });
  });

  describe('getBySlug', () => {
    it('throws 404 for a product that is not published/approved', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(
        withMedia(buildProduct({ isPublished: false })),
      );

      await expect(service.getBySlug('table-runner')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns the buyer projection plus related products for a published product', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(
        withMedia(buildProduct({ isPublished: true, approvalStatus: ProductApprovalStatus.APPROVED })),
      );
      vi.mocked(repo.findRelated).mockResolvedValue([]);

      const { product, related } = await service.getBySlug('table-runner');

      expect(product.slug).toBe('table-runner');
      expect(related).toEqual([]);
      expect(repo.findRelated).toHaveBeenCalledWith('cat-l3-1', 'prod-1', 4);
    });
  });

  describe('listForAdmin / getForSeller / getForAdmin', () => {
    it('listForAdmin includes both prices and a computed margin', async () => {
      vi.mocked(repo.findForAdmin).mockResolvedValue({
        data: [
          {
            ...withMedia(buildProduct({ sellerPrice: new Decimal(5), adminPrice: new Decimal(12) })),
            seller: { businessName: 'Jaipur Handicrafts' },
            category: { name: 'Textiles' },
          },
        ],
        total: 1,
      } as never);

      const { data } = await service.listForAdmin({}, { page: 1, limit: 20 });

      expect(data[0]).toMatchObject({ sellerPrice: '5', adminPrice: '12', margin: 7 });
    });

    it('getForSeller returns the seller projection for an owned product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(withMedia(buildProduct()));

      const result = await service.getForSeller('seller-1', 'prod-1');

      expect(result).not.toHaveProperty('adminPrice');
    });

    it('getForAdmin throws 404 for a product that does not exist', async () => {
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(null);

      await expect(service.getForAdmin('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('getForAdmin includes both prices and a computed margin', async () => {
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(
        withMedia(buildProduct({ sellerPrice: new Decimal(5), adminPrice: new Decimal(12) })),
      );

      const result = await service.getForAdmin('prod-1');

      expect(result).toMatchObject({ sellerPrice: '5', adminPrice: '12', margin: 7 });
    });
  });
});
