import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { CollectionsRepository } from './collections.repository';

describe('CollectionsRepository', () => {
  let db: MockPrismaClient;
  let repo: CollectionsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      collection: mockModel(),
      productCollection: mockModel(),
      product: mockModel(),
    });
    repo = new CollectionsRepository(db as never);
  });

  it('findById queries by id', async () => {
    db.collection.findUnique.mockResolvedValue({ id: 'col-1' });
    await repo.findById('col-1');
    expect(db.collection.findUnique).toHaveBeenCalledWith({ where: { id: 'col-1' } });
  });

  it('slugExists reflects existence', async () => {
    db.collection.count.mockResolvedValue(0);
    await expect(repo.slugExists('free')).resolves.toBe(false);
  });

  it('create defaults isFeatured false and status DRAFT when omitted', async () => {
    db.collection.create.mockResolvedValue({ id: 'col-1' });
    await repo.create({ name: 'Sustainable Living', slug: 'sustainable-living' });
    expect(db.collection.create).toHaveBeenCalledWith({
      data: {
        name: 'Sustainable Living',
        slug: 'sustainable-living',
        heroImage: undefined,
        editorialIntro: undefined,
        isFeatured: false,
        status: CollectionStatus.DRAFT,
        publishAt: undefined,
      },
    });
  });

  it('setStatus updates the status field', async () => {
    db.collection.update.mockResolvedValue({ id: 'col-1' });
    await repo.setStatus('col-1', CollectionStatus.PUBLISHED);
    expect(db.collection.update).toHaveBeenCalledWith({
      where: { id: 'col-1' },
      data: { status: CollectionStatus.PUBLISHED },
    });
  });

  it('findAdminList applies the status filter when given', async () => {
    db.collection.findMany.mockResolvedValue([]);
    db.collection.count.mockResolvedValue(0);
    await repo.findAdminList({ status: CollectionStatus.DRAFT }, { page: 1, limit: 20 });
    const arg = db.collection.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: CollectionStatus.DRAFT });
  });

  it('findPublicList only includes published or already-elapsed scheduled collections', async () => {
    db.collection.findMany.mockResolvedValue([]);
    db.collection.count.mockResolvedValue(0);
    await repo.findPublicList({ page: 1, limit: 20 });
    const arg = db.collection.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { status: CollectionStatus.PUBLISHED },
      { status: CollectionStatus.SCHEDULED, publishAt: { lte: expect.any(Date) } },
    ]);
  });

  it('findFeatured additionally scopes to isFeatured and applies the limit', async () => {
    db.collection.findMany.mockResolvedValue([]);
    await repo.findFeatured(6);
    const arg = db.collection.findMany.mock.calls[0][0];
    expect(arg.where.isFeatured).toBe(true);
    expect(arg.take).toBe(6);
  });

  it('findRelated excludes the given collection id', async () => {
    db.collection.findMany.mockResolvedValue([]);
    await repo.findRelated('col-1', 4);
    const arg = db.collection.findMany.mock.calls[0][0];
    expect(arg.where.id).toEqual({ not: 'col-1' });
  });

  describe('isVisible', () => {
    it('is true for PUBLISHED', () => {
      expect(repo.isVisible({ status: CollectionStatus.PUBLISHED } as never)).toBe(true);
    });

    it('is true for SCHEDULED with a past publishAt', () => {
      expect(
        repo.isVisible({ status: CollectionStatus.SCHEDULED, publishAt: new Date(Date.now() - 1000) } as never),
      ).toBe(true);
    });

    it('is false for SCHEDULED with a future publishAt', () => {
      expect(
        repo.isVisible({ status: CollectionStatus.SCHEDULED, publishAt: new Date(Date.now() + 100000) } as never),
      ).toBe(false);
    });

    it('is false for DRAFT', () => {
      expect(repo.isVisible({ status: CollectionStatus.DRAFT, publishAt: null } as never)).toBe(false);
    });
  });

  it('addProduct upserts the membership row', async () => {
    db.productCollection.upsert.mockResolvedValue({});
    await repo.addProduct('col-1', 'prod-1', 2);
    expect(db.productCollection.upsert).toHaveBeenCalledWith({
      where: { productId_collectionId: { productId: 'prod-1', collectionId: 'col-1' } },
      update: { sortOrder: 2 },
      create: { collectionId: 'col-1', productId: 'prod-1', sortOrder: 2 },
    });
  });

  it('removeProduct deletes the membership row', async () => {
    db.productCollection.deleteMany.mockResolvedValue({ count: 1 });
    await repo.removeProduct('col-1', 'prod-1');
    expect(db.productCollection.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'col-1', productId: 'prod-1' },
    });
  });

  it('reorderMembership issues one update per item inside a transaction', async () => {
    db.productCollection.update.mockResolvedValue({});
    await repo.reorderMembership('col-1', [{ productId: 'p1', sortOrder: 0 }]);
    expect(db.productCollection.update).toHaveBeenCalledWith({
      where: { productId_collectionId: { productId: 'p1', collectionId: 'col-1' } },
      data: { sortOrder: 0 },
    });
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('isProductApproved is true only for an approved, non-deleted product', async () => {
    db.product.findUnique.mockResolvedValue({ approvalStatus: 'APPROVED', deletedAt: null });
    await expect(repo.isProductApproved('p1')).resolves.toBe(true);
  });

  it('isProductApproved is false for a soft-deleted product', async () => {
    db.product.findUnique.mockResolvedValue({ approvalStatus: 'APPROVED', deletedAt: new Date() });
    await expect(repo.isProductApproved('p1')).resolves.toBe(false);
  });

  it('isProductApproved is false when the product does not exist', async () => {
    db.product.findUnique.mockResolvedValue(null);
    await expect(repo.isProductApproved('missing')).resolves.toBe(false);
  });
});
