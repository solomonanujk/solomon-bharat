import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category, CategoryStatus } from '@prisma/client';
import { buildMockCache } from '../../test-utils/mockCache';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Home Décor',
    slug: 'home-decor',
    level: 1,
    parentId: null,
    description: null,
    heroImage: null,
    status: CategoryStatus.ACTIVE,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): CategoriesRepository {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findChildren: vi.fn(),
    findAll: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    reorderMany: vi.fn(),
    countProductsInCategories: vi.fn(),
    groupProductCounts: vi.fn(),
  } as unknown as CategoriesRepository;
}

describe('CategoriesService', () => {
  let repo: CategoriesRepository;
  let service: CategoriesService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new CategoriesService(repo, buildMockCache());
  });

  describe('createCategory', () => {
    it('rejects a level 2 category whose parent is not level 1', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ id: 'parent-1', level: 2 }));

      await expect(
        service.createCategory({ name: 'Textiles', level: 2, parentId: 'parent-1' }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a level 1 category with a generated slug', async () => {
      vi.mocked(repo.create).mockResolvedValue(buildCategory({ name: 'Kitchenware', slug: 'kitchenware' }));

      const result = await service.createCategory({ name: 'Kitchenware', level: 1 });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Kitchenware', slug: 'kitchenware', level: 1 }),
      );
      expect(result.slug).toBe('kitchenware');
    });

    it('appends a suffix when the generated slug is already taken', async () => {
      vi.mocked(repo.slugExists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      vi.mocked(repo.create).mockResolvedValue(buildCategory());

      await service.createCategory({ name: 'Home Décor', level: 1 });

      const createArg = vi.mocked(repo.create).mock.calls[0][0];
      expect(createArg.slug).toMatch(/^home-decor-[a-z0-9]+$/);
    });
  });

  describe('archiveCategory', () => {
    it('blocks archiving a level 3 category with active products assigned', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ level: 3 }));
      vi.mocked(repo.countProductsInCategories).mockResolvedValue(3);

      await expect(service.archiveCategory('cat-1')).rejects.toMatchObject({
        statusCode: 409,
        details: { count: 3 },
      });

      expect(repo.setStatus).not.toHaveBeenCalled();
    });

    it('archives a level 1 category by checking every descendant leaf, not just direct children', async () => {
      const l1 = buildCategory({ id: 'l1', level: 1 });
      const l2 = buildCategory({ id: 'l2', level: 2, parentId: 'l1' });
      const l3 = buildCategory({ id: 'l3', level: 3, parentId: 'l2' });

      vi.mocked(repo.findById).mockResolvedValue(l1);
      vi.mocked(repo.findChildren).mockImplementation((parentId: string) => {
        if (parentId === 'l1') return Promise.resolve([l2]);
        if (parentId === 'l2') return Promise.resolve([l3]);
        return Promise.resolve([]);
      });
      vi.mocked(repo.countProductsInCategories).mockResolvedValue(0);
      vi.mocked(repo.setStatus).mockResolvedValue(buildCategory({ status: CategoryStatus.ARCHIVED }));

      await service.archiveCategory('l1');

      expect(repo.countProductsInCategories).toHaveBeenCalledWith(['l3'], false);
      expect(repo.setStatus).toHaveBeenCalledWith('l1', CategoryStatus.ARCHIVED);
    });

    it('rejects archiving a category that is already archived', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ status: CategoryStatus.ARCHIVED }));

      await expect(service.archiveCategory('cat-1')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('assertValidLeafCategory', () => {
    it('rejects a category that is not level 3', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ level: 1 }));

      await expect(service.assertValidLeafCategory('cat-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('accepts a level 3 category', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ level: 3 }));

      await expect(service.assertValidLeafCategory('cat-1')).resolves.toMatchObject({ level: 3 });
    });
  });

  describe('updateCategory', () => {
    it('rejects a slug already used by a different category', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory());
      vi.mocked(repo.findBySlug).mockResolvedValue(buildCategory({ id: 'other-cat' }));

      await expect(service.updateCategory('cat-1', { slug: 'taken' })).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates fields when the slug is free', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory());
      vi.mocked(repo.findBySlug).mockResolvedValue(null);
      vi.mocked(repo.update).mockResolvedValue(buildCategory({ name: 'Updated' }));

      await service.updateCategory('cat-1', { name: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith('cat-1', { name: 'Updated' });
    });
  });

  describe('restoreCategory', () => {
    it('rejects restoring a category that is already active', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ status: CategoryStatus.ACTIVE }));

      await expect(service.restoreCategory('cat-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('restores an archived category to active', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory({ status: CategoryStatus.ARCHIVED }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildCategory({ status: CategoryStatus.ACTIVE }));

      const result = await service.restoreCategory('cat-1');

      expect(repo.setStatus).toHaveBeenCalledWith('cat-1', CategoryStatus.ACTIVE);
      expect(result.status).toBe(CategoryStatus.ACTIVE);
    });
  });

  describe('reorderSiblings', () => {
    it('rejects reordering if any category id does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(buildCategory()).mockResolvedValueOnce(null);

      await expect(
        service.reorderSiblings([
          { id: 'cat-1', sortOrder: 0 },
          { id: 'missing', sortOrder: 1 },
        ]),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(repo.reorderMany).not.toHaveBeenCalled();
    });

    it('reorders once every category id is verified to exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildCategory());

      await service.reorderSiblings([{ id: 'cat-1', sortOrder: 3 }]);

      expect(repo.reorderMany).toHaveBeenCalledWith([{ id: 'cat-1', sortOrder: 3 }]);
    });
  });

  describe('getAdminTree', () => {
    it('includes archived categories and counts all non-deleted products, not just published', async () => {
      vi.mocked(repo.findAll).mockResolvedValue([buildCategory({ level: 1 })]);
      vi.mocked(repo.groupProductCounts).mockResolvedValue(new Map());

      await service.getAdminTree();

      expect(repo.findAll).toHaveBeenCalledWith(true);
      expect(repo.groupProductCounts).toHaveBeenCalledWith(false);
    });
  });

  describe('getCategoryDetailBySlug', () => {
    it('throws 404 for an archived category when not including archived', async () => {
      vi.mocked(repo.findBySlug).mockResolvedValue(buildCategory({ status: CategoryStatus.ARCHIVED }));

      await expect(service.getCategoryDetailBySlug('home-decor', false)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('builds a breadcrumb up to the root and attaches child product counts', async () => {
      const l1 = buildCategory({ id: 'l1', level: 1, parentId: null, slug: 'home-decor' });
      const l2 = buildCategory({ id: 'l2', level: 2, parentId: 'l1', slug: 'textiles' });

      vi.mocked(repo.findBySlug).mockResolvedValue(l1);
      vi.mocked(repo.findById).mockImplementation((id: string) =>
        Promise.resolve(id === 'l1' ? l1 : null),
      );
      vi.mocked(repo.findChildren).mockResolvedValue([l2]);
      vi.mocked(repo.countProductsInCategories).mockResolvedValue(0);

      const detail = await service.getCategoryDetailBySlug('home-decor', false);

      expect(detail.breadcrumb).toEqual([{ id: 'l1', name: l1.name, slug: 'home-decor', level: 1 }]);
      expect(detail.children[0]).toMatchObject({ id: 'l2', productCount: 0 });
    });
  });

  describe('getLeafDescendantIds', () => {
    it('resolves a level-1 category id down to its level-3 descendant ids', async () => {
      const l1 = buildCategory({ id: 'l1', level: 1 });
      const l2 = buildCategory({ id: 'l2', level: 2, parentId: 'l1' });
      const l3 = buildCategory({ id: 'l3', level: 3, parentId: 'l2' });

      vi.mocked(repo.findById).mockResolvedValue(l1);
      vi.mocked(repo.findChildren).mockImplementation((parentId: string) => {
        if (parentId === 'l1') return Promise.resolve([l2]);
        if (parentId === 'l2') return Promise.resolve([l3]);
        return Promise.resolve([]);
      });

      const ids = await service.getLeafDescendantIds('l1');

      expect(ids).toEqual(['l3']);
    });
  });

  describe('getPublicTree', () => {
    it('rolls published product counts up from leaves to root', async () => {
      const l1 = buildCategory({ id: 'l1', level: 1, parentId: null });
      const l2 = buildCategory({ id: 'l2', level: 2, parentId: 'l1' });
      const l3a = buildCategory({ id: 'l3a', level: 3, parentId: 'l2' });
      const l3b = buildCategory({ id: 'l3b', level: 3, parentId: 'l2' });

      vi.mocked(repo.findAll).mockResolvedValue([l1, l2, l3a, l3b]);
      vi.mocked(repo.groupProductCounts).mockResolvedValue(
        new Map([
          ['l3a', 2],
          ['l3b', 5],
        ]),
      );

      const tree = await service.getPublicTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].productCount).toBe(7);
      expect(tree[0].children[0].productCount).toBe(7);
      expect(tree[0].children[0].children.map((c) => c.productCount)).toEqual([2, 5]);
    });
  });
});
