import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Product, ProductApprovalStatus, ProductPricingChangeRequest, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/prisma';
import { buildMockCache } from '../../test-utils/mockCache';
import { CategoriesService } from '../categories/categories.service';
import { notificationsService } from '../notifications/notifications.service';
import { sellersService } from '../sellers/sellers.service';
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
    notifyPricingChangeApproved: vi.fn().mockResolvedValue(undefined),
    notifyPricingChangeRejected: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../sellers/sellers.service', () => ({
  sellersService: {
    getSellerDetailForAdmin: vi.fn(),
    getOrCreateHouseSellerProfile: vi.fn(),
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
    agentPrice: null,
    leadTime: null,
    approvalStatus: ProductApprovalStatus.PENDING,
    rejectionReason: null,
    isPublished: false,
    isFeatured: false,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tags: [],
    stepQty: 1,
    isHandmade: false,
    placeOfOrigin: null,
    isGITagged: false,
    howItIsMade: null,
    artisanName: null,
    ...overrides,
  };
}

function withMedia(product: Product): ProductWithMedia {
  return { ...product, images: [], variants: [], priceTiers: [] };
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
    updateProductTierAdminPrices: vi.fn().mockResolvedValue(undefined),
    updateVariantTierAdminPrices: vi.fn().mockResolvedValue(undefined),
    setCategory: vi.fn(),
    setPublished: vi.fn(),
    setFeatured: vi.fn(),
    softDelete: vi.fn(),
    findPublished: vi.fn(),
    findTrending: vi.fn(),
    findRecommended: vi.fn(),
    findRelated: vi.fn(),
    findForSeller: vi.fn(),
    findForAdmin: vi.fn(),
    findPendingPricingChange: vi.fn().mockResolvedValue(null),
    findPendingPricingChangesForProductIds: vi.fn().mockResolvedValue([]),
    findPendingPricingChanges: vi.fn(),
    findPricingChangeById: vi.fn(),
    upsertPendingPricingChange: vi.fn(),
    applyPricingChange: vi.fn(),
    setPricingChangeRejected: vi.fn(),
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

function buildChangeRequest(overrides: Partial<ProductPricingChangeRequest> = {}): ProductPricingChangeRequest {
  return {
    id: 'change-1',
    productId: 'prod-1',
    status: 'PENDING',
    proposedMoq: 20,
    proposedSellerPrice: new Decimal(6),
    proposedPriceTiers: [{ moq: 20, sellerPrice: 6 }],
    proposedVariants: [],
    rejectionReason: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductPricingChangeRequest;
}

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

  describe('createProductAsAdmin', () => {
    beforeEach(() => {
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED })));
      // sellersService is a module-level mock (not rebuilt per test like repo/categories
      // above), so its call history must be cleared explicitly between tests.
      vi.mocked(sellersService.getSellerDetailForAdmin).mockClear();
      vi.mocked(sellersService.getOrCreateHouseSellerProfile).mockClear();
    });

    it('rejects fewer than 2 images', async () => {
      await expect(
        service.createProductAsAdmin(
          'house',
          undefined,
          { name: 'X', description: 'Y', categoryId: 'cat-l3-1', materials: 'Cotton', moq: 1, declaredStock: 1, sellerPrice: 1 },
          [twoFiles[0]],
          'admin-1',
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects when no tier has a buyer price set', async () => {
      vi.mocked(sellersService.getOrCreateHouseSellerProfile).mockResolvedValue('house-profile-1');

      await expect(
        service.createProductAsAdmin(
          'house',
          undefined,
          {
            name: 'X', description: 'Y', categoryId: 'cat-l3-1', materials: 'Cotton',
            moq: 10, declaredStock: 100, sellerPrice: 5,
            priceTiers: [{ moq: 10, sellerPrice: 5 }],
          },
          twoFiles,
          'admin-1',
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the product on behalf of an existing seller, already approved and published', async () => {
      vi.mocked(sellersService.getSellerDetailForAdmin).mockResolvedValue({ id: 'seller-99' } as never);
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct({ sellerId: 'seller-99' })));

      const result = await service.createProductAsAdmin(
        'existing',
        'seller-99',
        {
          name: 'Table Runner', description: 'Handwoven', categoryId: 'cat-l3-1', materials: 'Cotton',
          moq: 20, declaredStock: 100, sellerPrice: 5,
          priceTiers: [
            { moq: 20, sellerPrice: 5, adminPrice: 9, agentPrice: 7 },
            { moq: 50, sellerPrice: 4, adminPrice: 7 },
          ],
        },
        twoFiles,
        'admin-1',
      );

      expect(sellersService.getSellerDetailForAdmin).toHaveBeenCalledWith('seller-99');
      expect(sellersService.getOrCreateHouseSellerProfile).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        'seller-99',
        expect.objectContaining({ name: 'Table Runner' }),
        expect.any(Array),
        {
          approvalStatus: ProductApprovalStatus.APPROVED,
          isPublished: true,
          publishedAt: expect.any(Date),
          adminPrice: 7, // cheapest of [9, 7]
          agentPrice: 7, // only one agent-priced tier
        },
      );
      expect(result.approvalStatus).toBe(ProductApprovalStatus.APPROVED);
    });

    it('provisions/reuses the shared house seller profile when sellerMode is "house"', async () => {
      vi.mocked(sellersService.getOrCreateHouseSellerProfile).mockResolvedValue('house-profile-1');
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct({ sellerId: 'house-profile-1' })));

      await service.createProductAsAdmin(
        'house',
        undefined,
        {
          name: 'House Product', description: 'Sourced directly', categoryId: 'cat-l3-1', materials: 'Cotton',
          moq: 10, declaredStock: 50, sellerPrice: 3,
          priceTiers: [{ moq: 10, sellerPrice: 3, adminPrice: 6 }],
        },
        twoFiles,
        'admin-1',
      );

      expect(sellersService.getOrCreateHouseSellerProfile).toHaveBeenCalled();
      expect(sellersService.getSellerDetailForAdmin).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        'house-profile-1',
        expect.objectContaining({ name: 'House Product' }),
        expect.any(Array),
        expect.objectContaining({ adminPrice: 6, agentPrice: null }),
      );
    });
  });

  describe('updateProduct', () => {
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

      await expect(service.approveProduct('prod-1', [{ id: 'tier-1', adminPrice: 100 }], undefined, 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('approving sets adminPrice from the cheapest priced tier, publishes, and stamps publishedAt', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...withMedia(buildProduct()),
        priceTiers: [
          { id: 'tier-1', productId: 'prod-1', moq: 10, sellerPrice: new Decimal(5), adminPrice: null },
          { id: 'tier-2', productId: 'prod-1', moq: 50, sellerPrice: new Decimal(4), adminPrice: null },
        ],
      } as never);
      vi.mocked(repo.setApproval).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED, isPublished: true }),
      );

      await service.approveProduct(
        'prod-1',
        [
          { id: 'tier-1', adminPrice: 42 },
          { id: 'tier-2', adminPrice: 30 },
        ],
        undefined,
        'admin-1',
      );

      expect(repo.updateProductTierAdminPrices).toHaveBeenCalledWith([
        { id: 'tier-1', adminPrice: 42 },
        { id: 'tier-2', adminPrice: 30 },
      ]);
      expect(repo.setApproval).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({
          approvalStatus: ProductApprovalStatus.APPROVED,
          adminPrice: 30,
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

      await expect(
        service.updatePrice('prod-1', [{ id: 'tier-1', adminPrice: 50 }], undefined, 'admin-1'),
      ).rejects.toMatchObject({
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
    it('rejects a search with neither category, collection, nor search term (400, per AGENTS.md)', async () => {
      await expect(service.listPublished({}, { page: 1, limit: 20 })).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.findPublished).not.toHaveBeenCalled();
    });

    it('allows a bare search term with no category or collection — the global navbar search', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [], total: 0 });

      await service.listPublished({ search: 'tote bag' }, { page: 1, limit: 20 });

      expect(repo.findPublished).toHaveBeenCalledWith(
        { search: 'tote bag' },
        { page: 1, limit: 20 },
        undefined,
      );
    });

    it('allows a bare sort mode with no category, collection, or search — the navbar quick links', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [], total: 0 });

      await service.listPublished({ sort: 'featured' }, { page: 1, limit: 20 });

      expect(repo.findPublished).toHaveBeenCalledWith(
        { sort: 'featured' },
        { page: 1, limit: 20 },
        undefined,
      );
    });

    it('routes sort=trending to findTrending instead of findPublished', async () => {
      vi.mocked(repo.findTrending).mockResolvedValue({ data: [], total: 0 });

      await service.listPublished({ sort: 'trending' }, { page: 1, limit: 20 });

      expect(repo.findTrending).toHaveBeenCalledWith({ page: 1, limit: 20 });
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

    it('applies a non-pricing edit to an already-approved product immediately, with no pending change', async () => {
      const live = buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED });
      vi.mocked(repo.findByIdRaw).mockResolvedValue(live);
      const withImages = {
        ...withMedia(live),
        images: [
          { id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 },
          { id: 'img-2', productId: 'prod-1', url: 'y', sortOrder: 1 },
        ],
      };
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(withImages);
      vi.mocked(repo.update).mockResolvedValue({ ...withImages, name: 'Updated Name' });

      const result = await service.updateProduct('seller-1', 'prod-1', { name: 'Updated Name' }, []);

      expect(repo.update).toHaveBeenCalledWith('prod-1', { name: 'Updated Name' }, [], 2);
      expect(repo.upsertPendingPricingChange).not.toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
      expect(result.pendingPricingChange).toBeNull();
    });

    it('stages a pricing/variant edit on an already-approved product instead of applying it', async () => {
      const live = buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED, moq: 10, sellerPrice: new Decimal(5) });
      vi.mocked(repo.findByIdRaw).mockResolvedValue(live);
      const liveWithMedia = {
        ...withMedia(live),
        images: [
          { id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 },
          { id: 'img-2', productId: 'prod-1', url: 'y', sortOrder: 1 },
        ],
        priceTiers: [
          { id: 't1', productId: 'prod-1', moq: 10, sellerPrice: new Decimal(5), adminPrice: new Decimal(8), agentPrice: null },
        ],
      };
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(liveWithMedia);
      vi.mocked(repo.update).mockResolvedValue(liveWithMedia);

      const result = await service.updateProduct(
        'seller-1',
        'prod-1',
        { moq: 20, sellerPrice: 6, priceTiers: [{ moq: 20, sellerPrice: 6 }] },
        [],
      );

      const [, updateArg] = vi.mocked(repo.update).mock.calls[0];
      expect(updateArg).not.toHaveProperty('moq');
      expect(updateArg).not.toHaveProperty('sellerPrice');
      expect(updateArg).not.toHaveProperty('priceTiers');
      expect(updateArg).not.toHaveProperty('variants');

      expect(repo.upsertPendingPricingChange).toHaveBeenCalledWith('prod-1', {
        moq: 20,
        sellerPrice: 6,
        priceTiers: [{ moq: 20, sellerPrice: 6 }],
        variants: [],
      });
      // Nothing live has been touched yet — buyers keep seeing the old pricing.
      expect(result.moq).toBe(10);
    });

    it('does not stage a pending change when the resubmitted pricing is identical to what is already live', async () => {
      const live = buildProduct({ approvalStatus: ProductApprovalStatus.APPROVED, moq: 10, sellerPrice: new Decimal(5) });
      vi.mocked(repo.findByIdRaw).mockResolvedValue(live);
      const liveWithMedia = {
        ...withMedia(live),
        images: [
          { id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 },
          { id: 'img-2', productId: 'prod-1', url: 'y', sortOrder: 1 },
        ],
        priceTiers: [
          { id: 't1', productId: 'prod-1', moq: 10, sellerPrice: new Decimal(5), adminPrice: null, agentPrice: null },
        ],
      };
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue(liveWithMedia);
      vi.mocked(repo.update).mockResolvedValue(liveWithMedia);

      await service.updateProduct(
        'seller-1',
        'prod-1',
        { name: 'Just a typo fix', moq: 10, sellerPrice: 5, priceTiers: [{ moq: 10, sellerPrice: 5 }] },
        [],
      );

      expect(repo.upsertPendingPricingChange).not.toHaveBeenCalled();
    });
  });

  describe('updateProductAsAdmin', () => {
    it('has no ownership check and does not block an already-approved product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(
        buildProduct({ sellerId: 'someone-else', approvalStatus: ProductApprovalStatus.APPROVED }),
      );
      // Returned both for the pre-update image-count check and, again, by the
      // getForAdmin() re-fetch this method returns — a real DB would reflect the
      // just-applied update on that second read, so the mock reflects it too.
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...withMedia(buildProduct({ name: 'Updated Name', approvalStatus: ProductApprovalStatus.APPROVED })),
        images: [
          { id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 },
          { id: 'img-2', productId: 'prod-1', url: 'y', sortOrder: 1 },
        ],
      });

      await expect(
        service.updateProductAsAdmin('prod-1', { name: 'Updated Name' }, [], 'admin-1'),
      ).resolves.toMatchObject({ name: 'Updated Name' });

      expect(repo.update).toHaveBeenCalledWith('prod-1', { name: 'Updated Name' }, [], 2);
    });

    it('rejects an image count outside 2-10 after applying add/remove', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...withMedia(buildProduct()),
        images: [{ id: 'img-1', productId: 'prod-1', url: 'x', sortOrder: 0 }],
      });

      await expect(
        service.updateProductAsAdmin('prod-1', { removeImageIds: ['img-1'] }, [], 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 404 for a soft-deleted or missing product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(null);

      await expect(
        service.updateProductAsAdmin('prod-1', { name: 'X' }, [], 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('approvePricingChange / rejectPricingChange / listPendingPricingChanges', () => {
    it('lists pending changes with their product name/slug attached', async () => {
      vi.mocked(repo.findPendingPricingChanges).mockResolvedValue({
        data: [{ ...buildChangeRequest(), product: { id: 'prod-1', name: 'Table Runner', slug: 'table-runner' } }],
        total: 1,
      });

      const { data, total } = await service.listPendingPricingChanges({ page: 1, limit: 20 });

      expect(total).toBe(1);
      expect(data[0].product).toEqual({ id: 'prod-1', name: 'Table Runner', slug: 'table-runner' });
      expect(data[0].proposedMoq).toBe(20);
    });

    it('throws 404 approving a change request that does not exist', async () => {
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(null);

      await expect(
        service.approvePricingChange('change-1', [{ id: 'flat-0', adminPrice: 8 }], [], 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 400 approving a change request that was already reviewed', async () => {
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(buildChangeRequest({ status: 'APPROVED' }));

      await expect(
        service.approvePricingChange('change-1', [{ id: 'flat-0', adminPrice: 8 }], [], 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('requires at least one tier to end up priced', async () => {
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(buildChangeRequest());

      await expect(service.approvePricingChange('change-1', [], [], 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(repo.applyPricingChange).not.toHaveBeenCalled();
    });

    it('prices the proposed tiers by synthetic key and applies the change atomically', async () => {
      const change = buildChangeRequest({
        proposedPriceTiers: [
          { moq: 20, sellerPrice: 6 },
          { moq: 50, sellerPrice: 5 },
        ],
      });
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(change);
      vi.mocked(repo.applyPricingChange).mockResolvedValue(withMedia(buildProduct({ id: 'prod-1' })));

      await service.approvePricingChange(
        'change-1',
        [
          { id: 'flat-0', adminPrice: 10, agentPrice: 9 },
          { id: 'flat-1', adminPrice: 8 },
        ],
        [],
        'admin-1',
      );

      expect(repo.applyPricingChange).toHaveBeenCalledWith(
        'prod-1',
        'change-1',
        {
          moq: 20,
          sellerPrice: 6,
          adminPrice: 8, // cheapest of [10, 8]
          agentPrice: 9, // only one agent-priced tier
          priceTiers: [
            { moq: 20, sellerPrice: 6, adminPrice: 10, agentPrice: 9 },
            { moq: 50, sellerPrice: 5, adminPrice: 8, agentPrice: undefined },
          ],
          variants: [],
        },
        'admin-1',
      );
      expect(notificationsService.notifyPricingChangeApproved).toHaveBeenCalledWith('seller-user-1', 'Table Runner');
    });

    it('rejects a pending change with a reason, leaving the live product untouched', async () => {
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(buildChangeRequest());
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());

      await service.rejectPricingChange('change-1', 'Prices too low for these MOQs', 'admin-1');

      expect(repo.setPricingChangeRejected).toHaveBeenCalledWith('change-1', {
        reason: 'Prices too low for these MOQs',
        reviewedById: 'admin-1',
      });
      expect(repo.applyPricingChange).not.toHaveBeenCalled();
      expect(notificationsService.notifyPricingChangeRejected).toHaveBeenCalledWith(
        'seller-user-1',
        'Table Runner',
        'Prices too low for these MOQs',
      );
    });

    it('throws 400 rejecting a change request that was already reviewed', async () => {
      vi.mocked(repo.findPricingChangeById).mockResolvedValue(buildChangeRequest({ status: 'REJECTED' }));

      await expect(
        service.rejectPricingChange('change-1', 'reason', 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 400 });
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

    it('exposes only admin-priced flat tiers, never the seller price', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue({
        ...withMedia(buildProduct({ isPublished: true, approvalStatus: ProductApprovalStatus.APPROVED })),
        priceTiers: [
          { id: 'tier-1', productId: 'prod-1', moq: 20, sellerPrice: new Decimal(5), adminPrice: new Decimal(8), agentPrice: null },
          { id: 'tier-2', productId: 'prod-1', moq: 50, sellerPrice: new Decimal(4), adminPrice: null, agentPrice: null },
        ],
      });
      vi.mocked(repo.findRelated).mockResolvedValue([]);

      const { product } = await service.getBySlug('table-runner');

      expect(product.priceTiers).toEqual([{ id: 'tier-1', moq: 20, adminPrice: '8', agentPrice: null }]);
      expect(JSON.stringify(product.priceTiers)).not.toContain('sellerPrice');
    });

    it('includes agentPrice for an authenticated AGENT viewer, top-level and per tier, but not for a buyer/guest', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue({
        ...withMedia(buildProduct({
          isPublished: true,
          approvalStatus: ProductApprovalStatus.APPROVED,
          agentPrice: new Decimal(7),
        })),
        priceTiers: [
          { id: 'tier-1', productId: 'prod-1', moq: 20, sellerPrice: new Decimal(5), adminPrice: new Decimal(8), agentPrice: new Decimal(6) },
        ],
      });
      vi.mocked(repo.findRelated).mockResolvedValue([]);

      const asAgent = await service.getBySlug('table-runner', Role.AGENT);
      expect(asAgent.product.agentPrice).toBe('7');
      expect(asAgent.product.priceTiers).toEqual([{ id: 'tier-1', moq: 20, adminPrice: '8', agentPrice: '6' }]);

      const asBuyer = await service.getBySlug('table-runner', Role.BUYER);
      expect(asBuyer.product.agentPrice).toBeNull();
      expect(asBuyer.product.priceTiers).toEqual([{ id: 'tier-1', moq: 20, adminPrice: '8', agentPrice: null }]);

      const asGuest = await service.getBySlug('table-runner');
      expect(asGuest.product.agentPrice).toBeNull();
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
