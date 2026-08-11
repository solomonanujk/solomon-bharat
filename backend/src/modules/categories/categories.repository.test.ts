import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { CategoriesRepository } from './categories.repository';

describe('CategoriesRepository', () => {
  let db: MockPrismaClient;
  let repo: CategoriesRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ category: mockModel(), product: mockModel() });
    repo = new CategoriesRepository(db as never);
  });

  it('findById queries by id', async () => {
    db.category.findUnique.mockResolvedValue({ id: 'c1' });
    await repo.findById('c1');
    expect(db.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('findBySlug queries by slug', async () => {
    db.category.findUnique.mockResolvedValue({ id: 'c1' });
    await repo.findBySlug('home-decor');
    expect(db.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'home-decor' } });
  });

  it('findChildren defaults to active-only children ordered by sortOrder', async () => {
    db.category.findMany.mockResolvedValue([]);
    await repo.findChildren('parent-1');
    expect(db.category.findMany).toHaveBeenCalledWith({
      where: { parentId: 'parent-1', status: CategoryStatus.ACTIVE },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('findChildren includes archived when requested', async () => {
    db.category.findMany.mockResolvedValue([]);
    await repo.findChildren('parent-1', true);
    expect(db.category.findMany).toHaveBeenCalledWith({
      where: { parentId: 'parent-1' },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('findAll defaults to active-only ordered by level then sortOrder', async () => {
    db.category.findMany.mockResolvedValue([]);
    await repo.findAll();
    expect(db.category.findMany).toHaveBeenCalledWith({
      where: { status: CategoryStatus.ACTIVE },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });
  });

  it('slugExists returns true when count > 0', async () => {
    db.category.count.mockResolvedValue(1);
    await expect(repo.slugExists('taken')).resolves.toBe(true);
  });

  it('slugExists returns false when count is 0', async () => {
    db.category.count.mockResolvedValue(0);
    await expect(repo.slugExists('free')).resolves.toBe(false);
  });

  it('create connects a parent when parentId is given', async () => {
    db.category.create.mockResolvedValue({ id: 'c1' });
    await repo.create({ name: 'Textiles', slug: 'textiles', level: 2, parentId: 'p1' });
    expect(db.category.create).toHaveBeenCalledWith({
      data: {
        name: 'Textiles',
        slug: 'textiles',
        level: 2,
        description: undefined,
        heroImage: undefined,
        sortOrder: 0,
        parent: { connect: { id: 'p1' } },
      },
    });
  });

  it('create omits the parent relation for a level 1 category', async () => {
    db.category.create.mockResolvedValue({ id: 'c1' });
    await repo.create({ name: 'Home Décor', slug: 'home-decor', level: 1 });
    const arg = db.category.create.mock.calls[0][0];
    expect(arg.data.parent).toBeUndefined();
  });

  it('update passes the input through as the data payload', async () => {
    db.category.update.mockResolvedValue({ id: 'c1' });
    await repo.update('c1', { name: 'Updated' });
    expect(db.category.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'Updated' } });
  });

  it('setStatus updates the status field', async () => {
    db.category.update.mockResolvedValue({ id: 'c1' });
    await repo.setStatus('c1', CategoryStatus.ARCHIVED);
    expect(db.category.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: CategoryStatus.ARCHIVED },
    });
  });

  it('reorderMany batches per-item sortOrder updates in a transaction', async () => {
    db.category.update.mockResolvedValue({});
    await repo.reorderMany([
      { id: 'c1', sortOrder: 0 },
      { id: 'c2', sortOrder: 1 },
    ]);
    expect(db.category.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { sortOrder: 0 } });
    expect(db.category.update).toHaveBeenCalledWith({ where: { id: 'c2' }, data: { sortOrder: 1 } });
  });

  it('countProductsInCategories returns 0 without querying when given no ids', async () => {
    await expect(repo.countProductsInCategories([])).resolves.toBe(0);
    expect(db.product.count).not.toHaveBeenCalled();
  });

  it('countProductsInCategories scopes to non-deleted products in the given categories', async () => {
    db.product.count.mockResolvedValue(3);
    await repo.countProductsInCategories(['c1', 'c2'], true);
    expect(db.product.count).toHaveBeenCalledWith({
      where: { categoryId: { in: ['c1', 'c2'] }, deletedAt: null, isPublished: true },
    });
  });

  it('groupProductCounts maps grouped rows into a categoryId->count Map', async () => {
    db.product.groupBy.mockResolvedValue([
      { categoryId: 'c1', _count: { _all: 5 } },
      { categoryId: 'c2', _count: { _all: 2 } },
    ]);
    const result = await repo.groupProductCounts(true);
    expect(db.product.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: { deletedAt: null, isPublished: true },
      _count: { _all: true },
    });
    expect(result).toEqual(
      new Map([
        ['c1', 5],
        ['c2', 2],
      ]),
    );
  });
});
