import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandStatus, Product, ProductApprovalStatus, Role, SellerType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildMockCache } from '../../test-utils/mockCache';
import { CategoriesService } from '../categories/categories.service';
import { ReviewsRepository } from '../reviews/reviews.repository';
import { ProductsRepository } from './products.repository';
import { ProductsService, invalidatePublishedListCache } from './products.service';
import { BrandSummarySource, ProductWithMedia, toBrandSummary } from './products.types';

vi.mock('../../providers/storage', () => ({
  storageProvider: {
    uploadImage: vi.fn().mockImplementation((_b: Buffer, name: string) =>
      Promise.resolve({ url: `https://cdn.example.com/${name}`, publicId: name }),
    ),
    uploadVideo: vi.fn(),
  },
}));
vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../config/prisma', () => ({
  prisma: {
    sellerProfile: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
    wishlistItem: { findMany: vi.fn().mockResolvedValue([]) },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../notifications/notifications.service', () => ({ notificationsService: {} }));
vi.mock('../sellers/sellers.service', () => ({
  sellersService: { getSellerDetailForAdmin: vi.fn(), getOrCreateHouseSellerProfile: vi.fn() },
}));

import { sellersService } from '../sellers/sellers.service';

const BRAND: BrandSummarySource = {
  id: 'brand-1',
  name: 'Acme Crafts',
  slug: 'acme-crafts',
  logoUrl: 'https://cdn.example.com/logo.png',
  isVerified: true,
  status: BrandStatus.ACTIVE,
  minOrderValueInr: new Decimal('5000.00'),
};

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sellerId: 'seller-1',
    brandId: null,
    categoryId: 'cat-l3-1',
    name: 'Table Runner',
    slug: 'table-runner',
    description: 'Handwoven',
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
    craftImageUrl: null,
    ecoMaterials: [],
    ecoPackaging: [],
    ecoProduction: [],
    isBestseller: false,
    tariffCode: null,
    ...overrides,
  };
}

function withMedia(product: Product, brand: BrandSummarySource | null = null): ProductWithMedia {
  return { ...product, images: [], videos: [], variants: [], priceTiers: [], brand };
}

function brandProduct(overrides: Partial<Product> = {}, brand: BrandSummarySource = BRAND): ProductWithMedia {
  return withMedia(
    buildProduct({
      brandId: brand.id,
      approvalStatus: ProductApprovalStatus.APPROVED,
      isPublished: true,
      adminPrice: new Decimal(20),
      sellerPrice: new Decimal(20),
      ...overrides,
    }),
    brand,
  );
}

function buildRepo(): ProductsRepository {
  return {
    findByIdWithMedia: vi.fn(),
    findByIdRaw: vi.fn(),
    findBySlugWithMedia: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    update: vi.fn(),
    setPublished: vi.fn(),
    findPublished: vi.fn(),
    findTrending: vi.fn(),
    findRelated: vi.fn().mockResolvedValue([]),
    findMoreFromBrand: vi.fn().mockResolvedValue([]),
    findBrandFacets: vi.fn(),
    findSellerContext: vi.fn().mockResolvedValue({ sellerType: SellerType.CURATED, brand: null }),
    findPendingPricingChange: vi.fn().mockResolvedValue(null),
    upsertPendingPricingChange: vi.fn(),
    setApproval: vi.fn(),
  } as unknown as ProductsRepository;
}

const files = [
  { buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
  { buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg' },
];

const createInput = {
  name: 'Table Runner',
  description: 'Handwoven',
  categoryId: 'cat-l3-1',
  materials: 'Cotton',
  moq: 10,
  declaredStock: 100,
  sellerPrice: 20,
  priceTiers: [
    { moq: 10, sellerPrice: 20 },
    { moq: 50, sellerPrice: 15 },
  ],
};

describe('ProductsService - marketplace brands', () => {
  let repo: ProductsRepository;
  let service: ProductsService;
  const cache = buildMockCache();

  beforeEach(() => {
    repo = buildRepo();
    const categories = {
      assertValidLeafCategory: vi.fn().mockResolvedValue({ id: 'cat-l3-1', level: 3 }),
      getLeafDescendantIds: vi.fn().mockResolvedValue(['cat-l3-1']),
    } as unknown as CategoriesService;
    const reviews = { getRatingSummaries: vi.fn().mockResolvedValue(new Map()) } as unknown as ReviewsRepository;
    service = new ProductsService(repo, categories, cache, reviews);
  });

  describe('toBrandSummary', () => {
    it('returns null for curated products', () => {
      expect(toBrandSummary(null)).toBeNull();
      expect(toBrandSummary(undefined)).toBeNull();
    });

    it('whitelists public fields only and converts minOrderValueInr to a number', () => {
      const dirty = { ...BRAND, legalName: 'Acme Pvt Ltd', gstin: '29ABCDE1234F1Z5', commissionFirstOverride: 10 };
      const out = toBrandSummary(dirty as BrandSummarySource);
      expect(out).toEqual({
        id: 'brand-1',
        name: 'Acme Crafts',
        slug: 'acme-crafts',
        logoUrl: 'https://cdn.example.com/logo.png',
        isVerified: true,
        minOrderValueInr: 5000,
      });
      expect(JSON.stringify(out)).not.toMatch(/legalName|gstin|commission|status/);
    });
  });

  describe('buyer serialisation', () => {
    it('curated payload gains only brand: null and still hides seller data', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({
        data: [withMedia(buildProduct({ adminPrice: new Decimal(20), isPublished: true }))],
        total: 1,
      });
      const { data } = await service.listPublished({ categoryId: 'c' }, { page: 1, limit: 20 }, Role.BUYER);
      expect(data[0].brand).toBeNull();
      expect(data[0].adminPrice).toBe('20');
      for (const key of ['sellerPrice', 'sellerId', 'brandId', 'declaredStock']) {
        expect(data[0]).not.toHaveProperty(key);
      }
    });

    it('brand product carries the brand tag', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [brandProduct()], total: 1 });
      const { data } = await service.listPublished({ brand: 'acme-crafts' }, { page: 1, limit: 20 }, Role.BUYER);
      expect(data[0].brand).toMatchObject({ slug: 'acme-crafts', name: 'Acme Crafts', minOrderValueInr: 5000 });
      expect(data[0]).not.toHaveProperty('brandId');
    });

    it('guests still get null prices on brand products (list and detail)', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [brandProduct()], total: 1 });
      const { data } = await service.listPublished({ brand: 'acme-crafts' }, { page: 1, limit: 20 });
      expect(data[0].adminPrice).toBeNull();
      expect(data[0].brand?.name).toBe('Acme Crafts');

      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(brandProduct());
      vi.mocked(repo.findMoreFromBrand).mockResolvedValue([brandProduct({ id: 'prod-2', slug: 'two' })]);
      const detail = await service.getBySlug('table-runner');
      expect(detail.product.adminPrice).toBeNull();
      expect(detail.moreFromBrand[0].adminPrice).toBeNull();
      const asBuyer = await service.getBySlug('table-runner', Role.BUYER);
      expect(asBuyer.product.adminPrice).toBe('20');
    });
  });

  describe('listPublished scope', () => {
    it('accepts a bare brand slug as a valid scope', async () => {
      vi.mocked(repo.findPublished).mockResolvedValue({ data: [], total: 0 });
      await service.listPublished({ brand: 'acme-crafts' }, { page: 1, limit: 20 });
      expect(repo.findPublished).toHaveBeenCalledWith({ brand: 'acme-crafts' }, { page: 1, limit: 20 }, undefined);
    });

    it('still rejects an unscoped request', async () => {
      await expect(service.listPublished({}, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('getBySlug', () => {
    it('404s a product whose brand is suspended', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(
        brandProduct({}, { ...BRAND, status: BrandStatus.SUSPENDED }),
      );
      await expect(service.getBySlug('table-runner')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns up to 8 other products of the same brand in moreFromBrand', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(brandProduct());
      vi.mocked(repo.findMoreFromBrand).mockResolvedValue([brandProduct({ id: 'prod-2', slug: 'two' })]);
      const { moreFromBrand } = await service.getBySlug('table-runner', Role.BUYER);
      expect(repo.findMoreFromBrand).toHaveBeenCalledWith('brand-1', 'prod-1', 8);
      expect(moreFromBrand).toHaveLength(1);
      expect(moreFromBrand[0].slug).toBe('two');
    });

    it('returns an empty moreFromBrand for curated products without querying', async () => {
      vi.mocked(repo.findBySlugWithMedia).mockResolvedValue(
        withMedia(buildProduct({ isPublished: true, approvalStatus: ProductApprovalStatus.APPROVED })),
      );
      const detail = await service.getBySlug('table-runner');
      expect(detail.moreFromBrand).toEqual([]);
      expect(detail.product.brand).toBeNull();
      expect(repo.findMoreFromBrand).not.toHaveBeenCalled();
    });
  });

  describe('listBrandFacets', () => {
    it('delegates to the repository', async () => {
      vi.mocked(repo.findBrandFacets).mockResolvedValue([{ slug: 'acme-crafts', name: 'Acme Crafts', count: 2 }]);
      await expect(service.listBrandFacets()).resolves.toEqual([{ slug: 'acme-crafts', name: 'Acme Crafts', count: 2 }]);
    });
  });

  describe('createProduct by seller type', () => {
    it('marketplace seller: auto-approves, publishes, adminPrice = sellerPrice, brandId set, tier prices mirrored', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue({
        sellerType: SellerType.MARKETPLACE,
        brand: { id: 'brand-1', status: BrandStatus.ACTIVE },
      });
      vi.mocked(repo.create).mockResolvedValue(brandProduct());

      const result = await service.createProduct('seller-1', createInput, files);

      const [, data, , , overrides] = vi.mocked(repo.create).mock.calls[0];
      expect(overrides).toMatchObject({
        brandId: 'brand-1',
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        adminPrice: 15,
      });
      expect(overrides?.publishedAt).toBeInstanceOf(Date);
      expect(data.priceTiers).toEqual([
        { moq: 10, sellerPrice: 20, adminPrice: 20 },
        { moq: 50, sellerPrice: 15, adminPrice: 15 },
      ]);
      // the brand sees its own price
      expect(result.sellerPrice).toBe('20');
      expect(result.isPublished).toBe(true);
    });

    it('marketplace seller without a brand profile is refused', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue({ sellerType: SellerType.MARKETPLACE, brand: null });
      await expect(service.createProduct('seller-1', createInput, files)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('curated seller: unchanged - no overrides, so it stays PENDING / unpublished', async () => {
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct()));
      const result = await service.createProduct('seller-1', createInput, files);
      const call = vi.mocked(repo.create).mock.calls[0];
      expect(call).toHaveLength(4);
      expect(call[1].priceTiers).toEqual(createInput.priceTiers);
      expect(result.approvalStatus).toBe(ProductApprovalStatus.PENDING);
      expect(result.isPublished).toBe(false);
    });
  });

  describe('saveDraft', () => {
    it('marketplace draft stays DRAFT but is tied to the brand', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue({
        sellerType: SellerType.MARKETPLACE,
        brand: { id: 'brand-1', status: BrandStatus.ACTIVE },
      });
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.DRAFT })));
      await service.saveDraft('seller-1', { name: 'Draft', categoryId: 'cat-l3-1', priceTiers: [{ moq: 5, sellerPrice: 9 }] });
      const [, data, , , overrides] = vi.mocked(repo.create).mock.calls[0];
      expect(overrides).toEqual({ approvalStatus: ProductApprovalStatus.DRAFT, brandId: 'brand-1' });
      expect(data.priceTiers).toEqual([{ moq: 5, sellerPrice: 9, adminPrice: 9 }]);
    });

    it('curated draft passes only the DRAFT override', async () => {
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.DRAFT })));
      await service.saveDraft('seller-1', { name: 'Draft', categoryId: 'cat-l3-1' });
      expect(vi.mocked(repo.create).mock.calls[0][4]).toEqual({ approvalStatus: ProductApprovalStatus.DRAFT });
    });
  });

  describe('createProductAsAdmin', () => {
    it('refuses to create on behalf of a marketplace brand', async () => {
      vi.mocked(sellersService.getSellerDetailForAdmin).mockResolvedValue({ id: 'seller-1' } as never);
      vi.mocked(repo.findSellerContext).mockResolvedValue({
        sellerType: SellerType.MARKETPLACE,
        brand: { id: 'brand-1', status: BrandStatus.ACTIVE },
      });
      await expect(
        service.createProductAsAdmin('existing', 'seller-1', createInput, files, 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    const marketplaceCtx = { sellerType: SellerType.MARKETPLACE, brand: { id: 'brand-1', status: BrandStatus.ACTIVE } };

    it('marketplace: edits to a live product apply immediately - no pending pricing change', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue(marketplaceCtx);
      const live = brandProduct();
      vi.mocked(repo.findByIdRaw).mockResolvedValue(live);
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({
        ...live,
        images: [{ id: 'i1' }, { id: 'i2' }] as never,
      });
      vi.mocked(repo.update).mockResolvedValue(live);

      await service.updateProduct('seller-1', 'prod-1', {
        sellerPrice: 25,
        priceTiers: [{ moq: 10, sellerPrice: 25 }],
      }, []);

      const [, input] = vi.mocked(repo.update).mock.calls[0];
      expect(input).toMatchObject({ sellerPrice: 25, adminPrice: 25 });
      expect(input.priceTiers).toEqual([{ moq: 10, sellerPrice: 25, adminPrice: 25 }]);
      expect(repo.upsertPendingPricingChange).not.toHaveBeenCalled();
    });

    it('marketplace: publishing a draft goes straight to APPROVED + published', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue(marketplaceCtx);
      const draft = withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.DRAFT, brandId: 'brand-1' }), BRAND);
      vi.mocked(repo.findByIdRaw).mockResolvedValue(draft);
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({ ...draft, images: [{ id: 'i1' }, { id: 'i2' }] as never });
      vi.mocked(repo.update).mockResolvedValue(draft);

      await service.updateProduct('seller-1', 'prod-1', {
        publish: true,
        description: 'd',
        materials: 'm',
        weight: '1',
        moq: 1,
        declaredStock: 5,
        sellerPrice: 30,
      }, []);

      const [, input] = vi.mocked(repo.update).mock.calls[0];
      expect(input).toMatchObject({
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        adminPrice: 30,
      });
      expect(input).not.toHaveProperty('publish');
    });

    it('curated: publishing a draft still goes to PENDING without publishing', async () => {
      const draft = withMedia(buildProduct({ approvalStatus: ProductApprovalStatus.DRAFT }));
      vi.mocked(repo.findByIdRaw).mockResolvedValue(draft);
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({ ...draft, images: [{ id: 'i1' }, { id: 'i2' }] as never });
      vi.mocked(repo.update).mockResolvedValue(draft);

      await service.updateProduct('seller-1', 'prod-1', {
        publish: true,
        description: 'd',
        materials: 'm',
        weight: '1',
        moq: 1,
        declaredStock: 5,
        sellerPrice: 30,
      }, []);

      const [, input] = vi.mocked(repo.update).mock.calls[0];
      expect(input.approvalStatus).toBe(ProductApprovalStatus.PENDING);
      expect(input).not.toHaveProperty('isPublished');
      expect(input).not.toHaveProperty('adminPrice');
    });
  });

  describe('quantity-tier pricing (brands)', () => {
    const ctx = { sellerType: SellerType.MARKETPLACE, brand: { id: 'brand-1', status: BrandStatus.ACTIVE } };
    const ladder = [
      { moq: 10, sellerPrice: 500 },
      { moq: 50, sellerPrice: 450 },
      { moq: 200, sellerPrice: 400 },
    ];
    const base = { ...createInput, sellerPrice: 500, priceTiers: undefined };

    beforeEach(() => {
      vi.mocked(repo.findSellerContext).mockResolvedValue(ctx);
      vi.mocked(repo.create).mockResolvedValue(brandProduct());
    });

    it('mirrors every tier to adminPrice and uses the cheapest tier as the product price', async () => {
      await service.createProduct('seller-1', { ...base, priceTiers: ladder }, files);

      const [, data, , , overrides] = vi.mocked(repo.create).mock.calls[0];
      expect(data.priceTiers).toEqual(ladder.map((t) => ({ ...t, adminPrice: t.sellerPrice })));
      expect(data.sellerPrice).toBe(400);
      expect(overrides).toMatchObject({ brandId: 'brand-1', adminPrice: 400, isPublished: true });
    });

    it('prices variant ladders and takes the cheapest across all variants', async () => {
      await service.createProduct(
        'seller-1',
        {
          ...base,
          variants: [
            { type: 'Size', value: 'S', status: 'ACTIVE' as const, priceTiers: [{ moq: 10, sellerPrice: 300 }, { moq: 20, sellerPrice: 250 }] },
            { type: 'Size', value: 'L', status: 'ACTIVE' as const, priceTiers: [{ moq: 10, sellerPrice: 320 }] },
          ],
        },
        files,
      );

      const [, data, , , overrides] = vi.mocked(repo.create).mock.calls[0];
      expect(data.variants?.[0].priceTiers).toEqual([
        { moq: 10, sellerPrice: 300, adminPrice: 300 },
        { moq: 20, sellerPrice: 250, adminPrice: 250 },
      ]);
      expect(overrides).toMatchObject({ adminPrice: 250 });
    });

    it.each([
      ['first tier not at the product MOQ', [{ moq: 5, sellerPrice: 500 }, { moq: 50, sellerPrice: 450 }]],
      ['non-increasing quantities', [{ moq: 10, sellerPrice: 500 }, { moq: 10, sellerPrice: 450 }]],
      ['a higher quantity costing more', [{ moq: 10, sellerPrice: 400 }, { moq: 50, sellerPrice: 450 }]],
      [
        'more than 5 tiers',
        [10, 20, 30, 40, 50, 60].map((moq, i) => ({ moq, sellerPrice: 500 - i * 10 })),
      ],
    ])('rejects %s', async (_label, tiers) => {
      await expect(service.createProduct('seller-1', { ...base, priceTiers: tiers }, files)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('validates each variant ladder', async () => {
      await expect(
        service.createProduct(
          'seller-1',
          {
            ...base,
            variants: [
              { type: 'Size', value: 'S', status: 'ACTIVE' as const, priceTiers: [{ moq: 10, sellerPrice: 300 }, { moq: 20, sellerPrice: 350 }] },
            ],
          },
          files,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('leaves curated sellers untouched (no brand tier rules)', async () => {
      vi.mocked(repo.findSellerContext).mockResolvedValue({ sellerType: SellerType.CURATED, brand: null });
      vi.mocked(repo.create).mockResolvedValue(withMedia(buildProduct()));
      await service.createProduct(
        'seller-1',
        { ...base, priceTiers: [{ moq: 5, sellerPrice: 500 }, { moq: 50, sellerPrice: 600 }] },
        files,
      );
      expect(repo.create).toHaveBeenCalled();
    });

    it('re-derives adminPrice from the cheapest tier when a live product is edited', async () => {
      const live = brandProduct();
      vi.mocked(repo.findByIdRaw).mockResolvedValue(live);
      vi.mocked(repo.findByIdWithMedia).mockResolvedValue({ ...live, images: [{ id: 'i1' }, { id: 'i2' }] as never });
      vi.mocked(repo.update).mockResolvedValue(live);

      await service.updateProduct('seller-1', 'prod-1', { moq: 10, sellerPrice: 500, priceTiers: ladder }, []);

      const [, input] = vi.mocked(repo.update).mock.calls[0];
      expect(input).toMatchObject({ sellerPrice: 400, adminPrice: 400 });
      expect(input.priceTiers).toEqual(ladder.map((t) => ({ ...t, adminPrice: t.sellerPrice })));
      expect(repo.upsertPendingPricingChange).not.toHaveBeenCalled();
    });

    it('rejects an invalid ladder on update', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(brandProduct());
      await expect(
        service.updateProduct(
          'seller-1',
          'prod-1',
          { moq: 10, priceTiers: [{ moq: 10, sellerPrice: 100 }, { moq: 5, sellerPrice: 90 }] },
          [],
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('setPublishedBySeller / updatePrice guards', () => {
    it('brand can unpublish its own product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(brandProduct());
      vi.mocked(repo.setPublished).mockResolvedValue(buildProduct({ isPublished: false }));
      await service.setPublishedBySeller('seller-1', 'prod-1', false);
      expect(repo.setPublished).toHaveBeenCalledWith('prod-1', false);
    });

    it('brand can republish an approved, priced product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(brandProduct({ isPublished: false }));
      vi.mocked(repo.setPublished).mockResolvedValue(buildProduct({ isPublished: true }));
      await service.setPublishedBySeller('seller-1', 'prod-1', true);
      expect(repo.setPublished).toHaveBeenCalledWith('prod-1', true);
    });

    it('refuses a curated product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildProduct());
      await expect(service.setPublishedBySeller('seller-1', 'prod-1', true)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("refuses another seller's product", async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(brandProduct({ sellerId: 'other' }));
      await expect(service.setPublishedBySeller('seller-1', 'prod-1', false)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('admin cannot re-price a brand product', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(brandProduct());
      await expect(service.updatePrice('prod-1', [], [], 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('cache invalidation', () => {
    it('exposes a public invalidatePublishedListCache and a module-level helper', async () => {
      await expect(service.invalidatePublishedListCache()).resolves.toBeUndefined();
      expect(typeof invalidatePublishedListCache).toBe('function');
    });
  });
});
