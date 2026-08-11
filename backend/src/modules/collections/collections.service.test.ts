import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Collection, CollectionStatus } from '@prisma/client';
import { buildMockCache } from '../../test-utils/mockCache';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
import { ProductsService } from '../products/products.service';

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function buildCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'col-1',
    name: 'Sustainable Living',
    slug: 'sustainable-living',
    heroImage: null,
    editorialIntro: null,
    isFeatured: false,
    status: CollectionStatus.DRAFT,
    publishAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): CollectionsRepository {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    setFeatured: vi.fn(),
    findAdminList: vi.fn(),
    findPublicList: vi.fn(),
    findFeatured: vi.fn(),
    findRelated: vi.fn(),
    isVisible: vi.fn(),
    addProduct: vi.fn(),
    removeProduct: vi.fn(),
    reorderMembership: vi.fn(),
    countProducts: vi.fn(),
    isProductApproved: vi.fn(),
    findMembers: vi.fn(),
  } as unknown as CollectionsRepository;
}

function buildMockProducts(): ProductsService {
  return {
    listPublished: vi.fn(),
    listForAdmin: vi.fn(),
  } as unknown as ProductsService;
}

describe('CollectionsService', () => {
  let repo: CollectionsRepository;
  let products: ProductsService;
  let service: CollectionsService;

  beforeEach(() => {
    repo = buildMockRepo();
    products = buildMockProducts();
    service = new CollectionsService(repo, products, buildMockCache());
  });

  describe('addProduct', () => {
    it('rejects adding a product that is not approved', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.isProductApproved).mockResolvedValue(false);

      await expect(
        service.addProduct('col-1', { productId: 'prod-1' }, 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.addProduct).not.toHaveBeenCalled();
    });

    it('adds an approved product at the end of the current membership', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.isProductApproved).mockResolvedValue(true);
      vi.mocked(repo.countProducts).mockResolvedValue(3);

      await service.addProduct('col-1', { productId: 'prod-1' }, 'admin-1');

      expect(repo.addProduct).toHaveBeenCalledWith('col-1', 'prod-1', 3);
    });

    it('rejects operating on a collection that does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.addProduct('missing', { productId: 'prod-1' }, 'admin-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('archiveCollection', () => {
    it('archives without touching product membership or requiring an empty collection', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection({ status: CollectionStatus.PUBLISHED }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildCollection({ status: CollectionStatus.ARCHIVED }));

      const result = await service.archiveCollection('col-1');

      expect(repo.setStatus).toHaveBeenCalledWith('col-1', CollectionStatus.ARCHIVED);
      expect(repo.removeProduct).not.toHaveBeenCalled();
      expect(result.status).toBe(CollectionStatus.ARCHIVED);
    });
  });

  describe('createCollection', () => {
    it('generates a slug and creates the collection in DRAFT by default', async () => {
      vi.mocked(repo.create).mockResolvedValue(buildCollection());

      await service.createCollection({ name: 'Sustainable Living' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sustainable Living', slug: 'sustainable-living' }),
      );
    });
  });

  describe('updateCollection', () => {
    it('rejects a slug already used by a different collection', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.findBySlug).mockResolvedValue(buildCollection({ id: 'other-col' }));

      await expect(
        service.updateCollection('col-1', { slug: 'taken-slug' }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows keeping the same slug on the same collection', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.findBySlug).mockResolvedValue(buildCollection());
      vi.mocked(repo.update).mockResolvedValue(buildCollection({ name: 'Updated' }));

      await service.updateCollection('col-1', { slug: 'sustainable-living', name: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith('col-1', { slug: 'sustainable-living', name: 'Updated' });
    });
  });

  describe('status transitions', () => {
    it('publishCollection sets status to PUBLISHED', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.setStatus).mockResolvedValue(buildCollection({ status: CollectionStatus.PUBLISHED }));

      const result = await service.publishCollection('col-1');

      expect(repo.setStatus).toHaveBeenCalledWith('col-1', CollectionStatus.PUBLISHED);
      expect(result.status).toBe(CollectionStatus.PUBLISHED);
    });

    it('unpublishToDraft sets status back to DRAFT', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection({ status: CollectionStatus.PUBLISHED }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildCollection({ status: CollectionStatus.DRAFT }));

      const result = await service.unpublishToDraft('col-1');

      expect(repo.setStatus).toHaveBeenCalledWith('col-1', CollectionStatus.DRAFT);
      expect(result.status).toBe(CollectionStatus.DRAFT);
    });

    it('setFeatured toggles the featured flag', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.setFeatured).mockResolvedValue(buildCollection({ isFeatured: true }));

      const result = await service.setFeatured('col-1', true);

      expect(repo.setFeatured).toHaveBeenCalledWith('col-1', true);
      expect(result.isFeatured).toBe(true);
    });

    it('rejects any status transition on a collection that does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.publishCollection('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('removeProduct / reorderMembership', () => {
    it('removeProduct delegates to the repository and audit-logs it', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());

      await service.removeProduct('col-1', 'prod-1', 'admin-1');

      expect(repo.removeProduct).toHaveBeenCalledWith('col-1', 'prod-1');
    });

    it('reorderMembership rejects when the collection does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.reorderMembership('missing', [{ productId: 'prod-1', sortOrder: 0 }]),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(repo.reorderMembership).not.toHaveBeenCalled();
    });

    it('reorderMembership delegates to the repository when the collection exists', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());

      await service.reorderMembership('col-1', [{ productId: 'prod-1', sortOrder: 2 }]);

      expect(repo.reorderMembership).toHaveBeenCalledWith('col-1', [{ productId: 'prod-1', sortOrder: 2 }]);
    });
  });

  describe('getAdminDetail', () => {
    it('stringifies member product prices and includes membership sortOrder', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCollection());
      vi.mocked(repo.findMembers).mockResolvedValue([
        {
          sortOrder: 1,
          product: {
            id: 'prod-1',
            name: 'Table Runner',
            slug: 'table-runner',
            sellerPrice: { toString: () => '5' } as never,
            adminPrice: { toString: () => '12' } as never,
            approvalStatus: 'APPROVED',
            isPublished: true,
            images: [],
          },
        },
      ] as never);

      const detail = await service.getAdminDetail('col-1');

      expect(detail.products[0]).toMatchObject({ sellerPrice: '5', adminPrice: '12', sortOrder: 1 });
    });
  });

  describe('listAdmin / listPublic / listFeatured', () => {
    it('listAdmin passes filter and pagination through to the repository', async () => {
      vi.mocked(repo.findAdminList).mockResolvedValue({ data: [], total: 0 });

      await service.listAdmin({ status: CollectionStatus.DRAFT }, { page: 1, limit: 20 });

      expect(repo.findAdminList).toHaveBeenCalledWith({ status: CollectionStatus.DRAFT }, { page: 1, limit: 20 });
    });

    it('listFeatured defaults to a limit of 6', async () => {
      vi.mocked(repo.findFeatured).mockResolvedValue([]);

      await service.listFeatured();

      expect(repo.findFeatured).toHaveBeenCalledWith(6);
    });
  });

  describe('getPublicDetail', () => {
    it('rejects a collection that is not visible (draft or archived)', async () => {
      vi.mocked(repo.findBySlug).mockResolvedValue(buildCollection({ status: CollectionStatus.DRAFT }));
      vi.mocked(repo.isVisible).mockReturnValue(false);

      await expect(service.getPublicDetail('sustainable-living', { page: 1, limit: 20 })).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(products.listPublished).not.toHaveBeenCalled();
    });

    it('scopes product listing to this collection id when visible', async () => {
      const collection = buildCollection({ status: CollectionStatus.PUBLISHED });
      vi.mocked(repo.findBySlug).mockResolvedValue(collection);
      vi.mocked(repo.isVisible).mockReturnValue(true);
      vi.mocked(products.listPublished).mockResolvedValue({ data: [], total: 0 });
      vi.mocked(repo.findRelated).mockResolvedValue([]);

      await service.getPublicDetail('sustainable-living', { page: 1, limit: 20 });

      expect(products.listPublished).toHaveBeenCalledWith(
        { collectionId: 'col-1' },
        { page: 1, limit: 20 },
      );
    });
  });
});
