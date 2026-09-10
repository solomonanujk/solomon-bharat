import { describe, it, expect, beforeEach } from 'vitest';
import { ProductApprovalStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { ProductsRepository } from './products.repository';

describe('ProductsRepository', () => {
  let db: MockPrismaClient;
  let repo: ProductsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      product: mockModel(),
      productImage: mockModel(),
      productVariant: mockModel(),
      productPriceTier: mockModel(),
      productPricingChangeRequest: mockModel(),
      orderItem: mockModel(),
    });
    repo = new ProductsRepository(db as never);
  });

  const MEDIA_INCLUDE = {
    images: { orderBy: { sortOrder: 'asc' } },
    variants: {
      include: {
        attributes: { orderBy: { name: 'asc' } },
        priceTiers: { orderBy: { moq: 'asc' } },
      },
    },
    priceTiers: { orderBy: { moq: 'asc' } },
  };

  it('findByIdWithMedia includes ordered images, variants, and price tiers', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1' });
    await repo.findByIdWithMedia('p1');
    expect(db.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: MEDIA_INCLUDE,
    });
  });

  it('findByIdRaw queries without includes', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1' });
    await repo.findByIdRaw('p1');
    expect(db.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('slugExists reflects whether a matching product exists', async () => {
    db.product.count.mockResolvedValue(1);
    await expect(repo.slugExists('table-runner')).resolves.toBe(true);
  });

  it('create builds nested image and variant creates', async () => {
    db.product.create.mockResolvedValue({ id: 'p1' });
    await repo.create(
      'seller-1',
      {
        categoryId: 'cat-1',
        name: 'Table Runner',
        slug: 'table-runner',
        description: 'desc',
        materials: 'Cotton',
        moq: 10,
        declaredStock: 100,
        sellerPrice: 5,
        variants: [{ type: 'Color', value: 'Red' }],
      },
      ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
    );

    const arg = db.product.create.mock.calls[0][0];
    expect(arg.data.sellerId).toBe('seller-1');
    expect(arg.data.images.create).toEqual([
      { url: 'https://cdn/1.jpg', sortOrder: 0 },
      { url: 'https://cdn/2.jpg', sortOrder: 1 },
    ]);
    expect(arg.data.variants.create).toEqual([
      {
        type: 'Color',
        value: 'Red',
        sku: undefined,
        status: 'ACTIVE',
        imageUrl: undefined,
        attributes: { create: [{ name: 'Color', value: 'Red' }] },
        priceTiers: undefined,
      },
    ]);
  });

  it('create passes adminPrice/agentPrice per flat tier and applies admin overrides when given', async () => {
    db.product.create.mockResolvedValue({ id: 'p1' });

    await repo.create(
      'seller-1',
      {
        categoryId: 'cat-1',
        name: 'Table Runner',
        slug: 'table-runner',
        description: 'desc',
        materials: 'Cotton',
        moq: 20,
        declaredStock: 100,
        sellerPrice: 5,
        priceTiers: [{ moq: 20, sellerPrice: 5, adminPrice: 9, agentPrice: 7 }],
      },
      [],
      {
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date('2026-01-01'),
        adminPrice: 9,
        agentPrice: 7,
      },
    );

    const arg = db.product.create.mock.calls[0][0];
    expect(arg.data.priceTiers.create).toEqual([{ moq: 20, sellerPrice: 5, adminPrice: 9, agentPrice: 7 }]);
    expect(arg.data.approvalStatus).toBe(ProductApprovalStatus.APPROVED);
    expect(arg.data.isPublished).toBe(true);
    expect(arg.data.adminPrice).toBe(9);
    expect(arg.data.agentPrice).toBe(7);
  });

  it('update batches image removal, image addition, variant replacement, and the scalar update in one transaction', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1' });

    await repo.update(
      'p1',
      { name: 'Updated', removeImageIds: ['img-old'], variants: [{ type: 'Size', value: 'M' }] },
      ['https://cdn/new.jpg'],
      1,
    );

    expect(db.productImage.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['img-old'] }, productId: 'p1' },
    });
    expect(db.productImage.createMany).toHaveBeenCalledWith({
      data: [{ productId: 'p1', url: 'https://cdn/new.jpg', sortOrder: 1 }],
    });
    expect(db.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
    expect(db.productVariant.create).toHaveBeenCalledWith({
      data: {
        productId: 'p1',
        type: 'Size',
        value: 'M',
        sku: undefined,
        status: 'ACTIVE',
        imageUrl: undefined,
        attributes: { create: [{ name: 'Size', value: 'M' }] },
        priceTiers: undefined,
      },
    });
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'Updated' } });
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('setApproval updates only the approval-related fields', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' });
    await repo.setApproval('p1', { approvalStatus: ProductApprovalStatus.APPROVED, adminPrice: 20 });
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { approvalStatus: ProductApprovalStatus.APPROVED, adminPrice: 20 },
    });
  });

  it('setPublished stamps publishedAt when publishing', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' });
    await repo.setPublished('p1', true);
    const arg = db.product.update.mock.calls[0][0];
    expect(arg.data.isPublished).toBe(true);
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
  });

  it('setPublished clears publishedAt when unpublishing', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' });
    await repo.setPublished('p1', false);
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isPublished: false, publishedAt: undefined },
    });
  });

  it('softDelete sets deletedAt and unpublishes', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' });
    await repo.softDelete('p1');
    const arg = db.product.update.mock.calls[0][0];
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
    expect(arg.data.isPublished).toBe(false);
  });

  it('findPublished scopes to approved, published, non-deleted products within the given category ids', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ categoryId: 'cat-1' }, { page: 2, limit: 10 }, ['leaf-1', 'leaf-2']);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      deletedAt: null,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
      categoryId: { in: ['leaf-1', 'leaf-2'] },
    });
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(10);
  });

  it('findPublished scopes by collectionId membership when given', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ collectionId: 'col-1' }, { page: 1, limit: 20 }, undefined);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where.collections).toEqual({ some: { collectionId: 'col-1' } });
  });

  it('findPublished filters by placeOfOrigin and leadTime (contains, case-insensitive)', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ placeOfOrigin: 'Jaipur', leadTime: '2 weeks' }, { page: 1, limit: 20 }, undefined);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where.placeOfOrigin).toEqual({ contains: 'Jaipur', mode: 'insensitive' });
    expect(arg.where.leadTime).toEqual({ contains: '2 weeks', mode: 'insensitive' });
  });

  it('findDistinctPlaceOfOrigin returns only real, non-empty values from published products', async () => {
    db.product.findMany.mockResolvedValue([
      { placeOfOrigin: 'Jaipur, India' },
      { placeOfOrigin: null },
      { placeOfOrigin: '  ' },
      { placeOfOrigin: 'Moradabad, India' },
    ]);

    const result = await repo.findDistinctPlaceOfOrigin();

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      deletedAt: null,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
      placeOfOrigin: { not: null },
    });
    expect(arg.distinct).toEqual(['placeOfOrigin']);
    expect(result).toEqual(['Jaipur, India', 'Moradabad, India']);
  });

  it('findPublished matches a search term against name, description, or materials — no category/collection needed', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ search: 'tote bag' }, { page: 1, limit: 20 }, undefined);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where.categoryId).toBeUndefined();
    expect(arg.where.collections).toBeUndefined();
    expect(arg.where.OR).toEqual([
      { name: { contains: 'tote bag', mode: 'insensitive' } },
      { description: { contains: 'tote bag', mode: 'insensitive' } },
      { materials: { contains: 'tote bag', mode: 'insensitive' } },
    ]);
  });

  it('findPublished with sort=featured filters to isFeatured products only', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ sort: 'featured' }, { page: 1, limit: 20 }, undefined);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where.isFeatured).toBe(true);
  });

  it('findPublished with sort=newest adds no extra filter — relies on the default createdAt desc order', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await repo.findPublished({ sort: 'newest' }, { page: 1, limit: 20 }, undefined);

    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where.isFeatured).toBeUndefined();
    expect(arg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('findTrending ranks products by order-item quantity within the trailing window, excluding pending/cancelled orders', async () => {
    db.orderItem.groupBy.mockResolvedValue([
      { productId: 'p-2', _sum: { quantity: 50 } },
      { productId: 'p-1', _sum: { quantity: 30 } },
      { productId: 'p-3', _sum: { quantity: 10 } },
    ]);
    db.product.findMany.mockResolvedValue([
      { id: 'p-1', name: 'Product One' },
      { id: 'p-2', name: 'Product Two' },
      { id: 'p-3', name: 'Product Three' },
    ]);

    const { data, total } = await repo.findTrending({ page: 1, limit: 20 });

    expect(total).toBe(3);
    // Re-ordered to match the groupBy ranking (p-2 first), not the findMany return order.
    expect(data.map((p) => p.id)).toEqual(['p-2', 'p-1', 'p-3']);

    const groupByArg = db.orderItem.groupBy.mock.calls[0][0];
    expect(groupByArg.where.order.status.notIn).toEqual(['PENDING_PAYMENT', 'CANCELLED']);
    expect(groupByArg.where.product).toMatchObject({
      deletedAt: null,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
    });
    expect(groupByArg.orderBy).toEqual({ _sum: { quantity: 'desc' } });
  });

  it('findTrending paginates over the ranked list and returns an empty page past the end', async () => {
    db.orderItem.groupBy.mockResolvedValue([
      { productId: 'p-1', _sum: { quantity: 50 } },
      { productId: 'p-2', _sum: { quantity: 30 } },
    ]);

    const { data, total } = await repo.findTrending({ page: 2, limit: 20 });

    expect(total).toBe(2);
    expect(data).toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it('findRelated excludes the given product and limits results', async () => {
    db.product.findMany.mockResolvedValue([]);
    await repo.findRelated('cat-1', 'p1', 4);
    expect(db.product.findMany).toHaveBeenCalledWith({
      where: {
        categoryId: 'cat-1',
        id: { not: 'p1' },
        deletedAt: null,
        isPublished: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
      },
      include: MEDIA_INCLUDE,
      take: 4,
    });
  });

  it('findForSeller scopes to the given seller and optional approval status', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);
    await repo.findForSeller('seller-1', { approvalStatus: ProductApprovalStatus.PENDING }, { page: 1, limit: 20 });
    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      sellerId: 'seller-1',
      deletedAt: null,
      approvalStatus: ProductApprovalStatus.PENDING,
    });
  });

  it('findForAdmin includes seller business name and category name', async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);
    await repo.findForAdmin({}, { page: 1, limit: 20 });
    const arg = db.product.findMany.mock.calls[0][0];
    expect(arg.include.seller).toEqual({ select: { businessName: true } });
    expect(arg.include.category).toEqual({ select: { name: true } });
  });

  describe('staged pricing/variant changes', () => {
    it('findPendingPricingChange looks up the one PENDING row for a product', async () => {
      db.productPricingChangeRequest.findFirst.mockResolvedValue(null);
      await repo.findPendingPricingChange('p1');
      expect(db.productPricingChangeRequest.findFirst).toHaveBeenCalledWith({
        where: { productId: 'p1', status: 'PENDING' },
      });
    });

    it('findPendingPricingChangesForProductIds short-circuits on an empty list without querying', async () => {
      const result = await repo.findPendingPricingChangesForProductIds([]);
      expect(result).toEqual([]);
      expect(db.productPricingChangeRequest.findMany).not.toHaveBeenCalled();
    });

    it('upsertPendingPricingChange replaces any existing PENDING row for the product', async () => {
      db.productPricingChangeRequest.create.mockResolvedValue({ id: 'change-1' });

      await repo.upsertPendingPricingChange('p1', {
        moq: 20,
        sellerPrice: 6,
        priceTiers: [{ moq: 20, sellerPrice: 6 }],
        variants: [],
      });

      expect(db.productPricingChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'p1', status: 'PENDING' },
      });
      expect(db.productPricingChangeRequest.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          proposedMoq: 20,
          proposedSellerPrice: 6,
          proposedPriceTiers: [{ moq: 20, sellerPrice: 6 }],
          proposedVariants: [],
        },
      });
    });

    it('applyPricingChange replaces variants/tiers with admin-priced ones and marks the request APPROVED, all in one transaction', async () => {
      db.product.findUnique.mockResolvedValue({ id: 'p1' });

      await repo.applyPricingChange(
        'p1',
        'change-1',
        {
          moq: 20,
          sellerPrice: 6,
          adminPrice: 10,
          agentPrice: null,
          priceTiers: [{ moq: 20, sellerPrice: 6, adminPrice: 10, agentPrice: undefined }],
          variants: [],
        },
        'admin-1',
      );

      expect(db.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(db.productPriceTier.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(db.productPriceTier.createMany).toHaveBeenCalledWith({
        data: [{ productId: 'p1', moq: 20, sellerPrice: 6, adminPrice: 10, agentPrice: undefined }],
      });
      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { moq: 20, sellerPrice: 6, adminPrice: 10, agentPrice: null },
      });
      expect(db.productPricingChangeRequest.update).toHaveBeenCalledWith({
        where: { id: 'change-1' },
        data: { status: 'APPROVED', reviewedById: 'admin-1', reviewedAt: expect.any(Date) },
      });
      expect(db.$transaction).toHaveBeenCalled();
    });

    it('setPricingChangeRejected records the reason and reviewer without touching the live product', async () => {
      await repo.setPricingChangeRejected('change-1', { reason: 'Prices too low', reviewedById: 'admin-1' });

      expect(db.productPricingChangeRequest.update).toHaveBeenCalledWith({
        where: { id: 'change-1' },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Prices too low',
          reviewedById: 'admin-1',
          reviewedAt: expect.any(Date),
        },
      });
      expect(db.product.update).not.toHaveBeenCalled();
    });
  });
});
