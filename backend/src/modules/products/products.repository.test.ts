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
    });
    repo = new ProductsRepository(db as never);
  });

  it('findByIdWithMedia includes ordered images and variants', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1' });
    await repo.findByIdWithMedia('p1');
    expect(db.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
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
    expect(arg.data.variants.create).toEqual([{ type: 'Color', value: 'Red' }]);
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
    expect(db.productVariant.createMany).toHaveBeenCalledWith({
      data: [{ productId: 'p1', type: 'Size', value: 'M' }],
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
      include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
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
});
