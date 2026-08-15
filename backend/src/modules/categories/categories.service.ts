import { Category, CategoryStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { slugify, uniqueSlugSuffix } from '../../utils/helpers';
import { storageProvider } from '../../providers/storage';
import { cache as defaultCache, CacheClient } from '../../utils/cache';
import { CategoriesRepository, categoriesRepository } from './categories.repository';
import {
  CategoryBreadcrumbEntry,
  CategoryDetail,
  CategoryNode,
  CreateCategoryInput,
  ReorderItem,
  UpdateCategoryInput,
  UploadedImageFile,
} from './categories.types';

const PUBLIC_TREE_CACHE_KEY = 'categories:public-tree';
const PUBLIC_TREE_CACHE_TTL_SECONDS = 300;

export class CategoriesService {
  constructor(
    private readonly repo: CategoriesRepository = categoriesRepository,
    private readonly cache: CacheClient = defaultCache,
  ) {}

  private async invalidatePublicTreeCache(): Promise<void> {
    await this.cache.del(PUBLIC_TREE_CACHE_KEY);
  }

  private async getByIdOrThrow(id: string): Promise<Category> {
    const category = await this.repo.findById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }
    return category;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    // eslint-disable-next-line no-await-in-loop
    while (await this.repo.slugExists(slug)) {
      slug = `${base}-${uniqueSlugSuffix()}`;
    }
    return slug;
  }

  /**
   * Products only ever attach to a Level 3 sub-subcategory (never L1/L2), so "descendant
   * leaf ids" is at most a 2-hop walk down a fixed 3-level tree — no recursive CTE needed.
   */
  private async getDescendantLeafIds(category: Category): Promise<string[]> {
    if (category.level === 3) return [category.id];

    if (category.level === 2) {
      const leaves = await this.repo.findChildren(category.id, true);
      return leaves.map((leaf) => leaf.id);
    }

    const subcategories = await this.repo.findChildren(category.id, true);
    const leafGroups = await Promise.all(
      subcategories.map((sub) => this.repo.findChildren(sub.id, true)),
    );
    return leafGroups.flat().map((leaf) => leaf.id);
  }

  /** Used by the products module to validate a submission's L3 category selection. */
  async assertValidLeafCategory(categoryId: string): Promise<Category> {
    const category = await this.getByIdOrThrow(categoryId);
    if (category.level !== 3) {
      throw AppError.badRequest('Products must be assigned to a level 3 sub-subcategory');
    }
    return category;
  }

  private async uploadHeroImage(file: UploadedImageFile): Promise<string> {
    const uploaded = await storageProvider.uploadImage(file.buffer, `${Date.now()}-${file.originalname}`, 'categories');
    return uploaded.url;
  }

  async createCategory(input: CreateCategoryInput, heroImageFile?: UploadedImageFile): Promise<Category> {
    if (input.level !== 1) {
      const parent = await this.getByIdOrThrow(input.parentId as string);
      if (parent.level !== input.level - 1) {
        throw AppError.badRequest(
          `A level ${input.level} category must have a level ${input.level - 1} parent`,
        );
      }
    }

    const slug = await this.generateUniqueSlug(input.name);
    const heroImage = heroImageFile ? await this.uploadHeroImage(heroImageFile) : input.heroImage;
    const category = await this.repo.create({ ...input, slug, heroImage });
    await this.invalidatePublicTreeCache();
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput & { removeHeroImage?: boolean },
    heroImageFile?: UploadedImageFile,
  ): Promise<Category> {
    await this.getByIdOrThrow(id);

    if (input.slug) {
      const existing = await this.repo.findBySlug(input.slug);
      if (existing && existing.id !== id) {
        throw AppError.conflict('This slug is already in use');
      }
    }

    const { removeHeroImage, ...rest } = input;
    const heroImage = heroImageFile
      ? await this.uploadHeroImage(heroImageFile)
      : removeHeroImage
        ? null
        : undefined;
    const category = await this.repo.update(id, { ...rest, ...(heroImage !== undefined && { heroImage }) });
    await this.invalidatePublicTreeCache();
    return category;
  }

  async archiveCategory(id: string): Promise<Category> {
    const category = await this.getByIdOrThrow(id);
    if (category.status === CategoryStatus.ARCHIVED) {
      throw AppError.badRequest('Category is already archived');
    }

    const leafIds = await this.getDescendantLeafIds(category);
    const activeProductCount = await this.repo.countProductsInCategories(leafIds, false);

    if (activeProductCount > 0) {
      throw AppError.conflict(
        `${activeProductCount} product(s) assigned. Reassign them before archiving.`,
        { count: activeProductCount },
      );
    }

    const updated = await this.repo.setStatus(id, CategoryStatus.ARCHIVED);
    await this.invalidatePublicTreeCache();
    return updated;
  }

  async restoreCategory(id: string): Promise<Category> {
    const category = await this.getByIdOrThrow(id);
    if (category.status === CategoryStatus.ACTIVE) {
      throw AppError.badRequest('Category is already active');
    }
    const updated = await this.repo.setStatus(id, CategoryStatus.ACTIVE);
    await this.invalidatePublicTreeCache();
    return updated;
  }

  async reorderSiblings(items: ReorderItem[]): Promise<void> {
    await Promise.all(items.map((item) => this.getByIdOrThrow(item.id)));
    await this.repo.reorderMany(items);
    await this.invalidatePublicTreeCache();
  }

  private buildTree(categories: Category[], counts: Map<string, number>): CategoryNode[] {
    const byParent = new Map<string | null, Category[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(category);
      byParent.set(key, bucket);
    }

    const toNode = (category: Category): CategoryNode => {
      const children = (byParent.get(category.id) ?? []).map(toNode);
      const productCount =
        category.level === 3
          ? counts.get(category.id) ?? 0
          : children.reduce((sum, child) => sum + child.productCount, 0);
      return { ...category, children, productCount };
    };

    return (byParent.get(null) ?? []).map(toNode);
  }

  async getPublicTree(): Promise<CategoryNode[]> {
    const cached = await this.cache.get<CategoryNode[]>(PUBLIC_TREE_CACHE_KEY);
    if (cached) return cached;

    const [categories, counts] = await Promise.all([
      this.repo.findAll(false),
      this.repo.groupProductCounts(true),
    ]);
    const tree = this.buildTree(categories, counts);
    await this.cache.set(PUBLIC_TREE_CACHE_KEY, tree, PUBLIC_TREE_CACHE_TTL_SECONDS);
    return tree;
  }

  async getAdminTree(): Promise<CategoryNode[]> {
    const [categories, counts] = await Promise.all([
      this.repo.findAll(true),
      this.repo.groupProductCounts(false),
    ]);
    return this.buildTree(categories, counts);
  }

  private async buildBreadcrumb(category: Category): Promise<CategoryBreadcrumbEntry[]> {
    const trail: CategoryBreadcrumbEntry[] = [
      { id: category.id, name: category.name, slug: category.slug, level: category.level },
    ];
    let current = category;
    while (current.parentId) {
      // eslint-disable-next-line no-await-in-loop
      const parent = await this.getByIdOrThrow(current.parentId);
      trail.unshift({ id: parent.id, name: parent.name, slug: parent.slug, level: parent.level });
      current = parent;
    }
    return trail;
  }

  async getCategoryDetailBySlug(slug: string, includeArchived: boolean): Promise<CategoryDetail> {
    const category = await this.repo.findBySlug(slug);
    if (!category || (!includeArchived && category.status === CategoryStatus.ARCHIVED)) {
      throw AppError.notFound('Category not found');
    }

    const [breadcrumb, children, productCount] = await Promise.all([
      this.buildBreadcrumb(category),
      this.repo.findChildren(category.id, includeArchived),
      this.getSubtreeProductCount(category, !includeArchived),
    ]);

    const childrenWithCounts = await Promise.all(
      children.map(async (child) => ({
        ...child,
        productCount: await this.getSubtreeProductCount(child, !includeArchived),
      })),
    );

    return { ...category, breadcrumb, children: childrenWithCounts, productCount };
  }

  async getSubtreeProductCount(category: Category, publishedOnly: boolean): Promise<number> {
    const leafIds = await this.getDescendantLeafIds(category);
    return this.repo.countProductsInCategories(leafIds, publishedOnly);
  }

  /**
   * Resolves a category id (any level) to the L3 leaf ids products actually attach to.
   * Used by the products module to scope context-search to "this level and all children" (PRD 10.6).
   */
  async getLeafDescendantIds(categoryId: string): Promise<string[]> {
    const category = await this.getByIdOrThrow(categoryId);
    return this.getDescendantLeafIds(category);
  }
}

export const categoriesService = new CategoriesService();
