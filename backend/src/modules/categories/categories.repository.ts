import { Category, CategoryStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateCategoryInput, ReorderItem, UpdateCategoryInput } from './categories.types';

export class CategoriesRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<Category | null> {
    return this.db.category.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.db.category.findUnique({ where: { slug } });
  }

  findChildren(parentId: string, includeArchived = false): Promise<Category[]> {
    return this.db.category.findMany({
      where: { parentId, ...(includeArchived ? {} : { status: CategoryStatus.ACTIVE }) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findAll(includeArchived = false): Promise<Category[]> {
    return this.db.category.findMany({
      where: includeArchived ? {} : { status: CategoryStatus.ACTIVE },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.db.category.count({ where: { slug } });
    return count > 0;
  }

  create(input: CreateCategoryInput & { slug: string; id?: string }): Promise<Category> {
    const data: Prisma.CategoryCreateInput = {
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      slug: input.slug,
      level: input.level,
      description: input.description,
      heroImage: input.heroImage,
      sortOrder: input.sortOrder ?? 0,
      ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
    };
    return this.db.category.create({ data });
  }

  update(id: string, input: UpdateCategoryInput): Promise<Category> {
    return this.db.category.update({ where: { id }, data: input });
  }

  setStatus(id: string, status: CategoryStatus): Promise<Category> {
    return this.db.category.update({ where: { id }, data: { status } });
  }

  async reorderMany(items: ReorderItem[]): Promise<void> {
    await this.db.$transaction(
      items.map((item) =>
        this.db.category.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
  }

  countProductsInCategories(categoryIds: string[], publishedOnly = false): Promise<number> {
    if (categoryIds.length === 0) return Promise.resolve(0);
    return this.db.product.count({
      where: {
        categoryId: { in: categoryIds },
        deletedAt: null,
        ...(publishedOnly ? { isPublished: true } : {}),
      },
    });
  }

  async groupProductCounts(publishedOnly = false): Promise<Map<string, number>> {
    const rows = await this.db.product.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, ...(publishedOnly ? { isPublished: true } : {}) },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.categoryId, row._count._all]));
  }
}

export const categoriesRepository = new CategoriesRepository();
