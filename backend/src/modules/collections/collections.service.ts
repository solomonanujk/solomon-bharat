import { Collection, CollectionStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { slugify, uniqueSlugSuffix } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { PaginationQuery } from '../../utils/pagination';
import { cache as defaultCache, bumpVersion, CacheClient, versionedListKey } from '../../utils/cache';
import { ProductsService, productsService } from '../products/products.service';
import { CollectionsRepository, collectionsRepository } from './collections.repository';
import {
  AddProductInput,
  AdminCollectionListFilter,
  CreateCollectionInput,
  ReorderMembershipItem,
  UpdateCollectionInput,
  UploadedImageFile,
} from './collections.types';

const FEATURED_CACHE_KEY = 'collections:featured';
const FEATURED_CACHE_TTL_SECONDS = 300;
const PUBLIC_LIST_CACHE_NAMESPACE = 'collections:public-list';
const PUBLIC_LIST_CACHE_TTL_SECONDS = 300;

export class CollectionsService {
  constructor(
    private readonly repo: CollectionsRepository = collectionsRepository,
    private readonly products: ProductsService = productsService,
    private readonly cache: CacheClient = defaultCache,
  ) {}

  private async invalidateListCaches(): Promise<void> {
    await this.cache.del(FEATURED_CACHE_KEY);
    await bumpVersion(this.cache, PUBLIC_LIST_CACHE_NAMESPACE);
  }

  private async getByIdOrThrow(id: string): Promise<Collection> {
    const collection = await this.repo.findById(id);
    if (!collection) {
      throw AppError.notFound('Collection not found');
    }
    return collection;
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

  private async uploadHeroImage(file: UploadedImageFile): Promise<string> {
    const uploaded = await storageProvider.uploadImage(file.buffer, `${Date.now()}-${file.originalname}`, 'collections');
    return uploaded.url;
  }

  async createCollection(input: CreateCollectionInput, heroImageFile?: UploadedImageFile): Promise<Collection> {
    const slug = await this.generateUniqueSlug(input.name);
    const heroImage = heroImageFile ? await this.uploadHeroImage(heroImageFile) : input.heroImage;
    const collection = await this.repo.create({ ...input, slug, heroImage });
    await this.invalidateListCaches();
    return collection;
  }

  async updateCollection(
    id: string,
    input: UpdateCollectionInput & { removeHeroImage?: boolean },
    heroImageFile?: UploadedImageFile,
  ): Promise<Collection> {
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
    const collection = await this.repo.update(id, { ...rest, ...(heroImage !== undefined && { heroImage }) });
    await this.invalidateListCaches();
    return collection;
  }

  async publishCollection(id: string): Promise<Collection> {
    await this.getByIdOrThrow(id);
    const collection = await this.repo.setStatus(id, CollectionStatus.PUBLISHED);
    await this.invalidateListCaches();
    return collection;
  }

  async unpublishToDraft(id: string): Promise<Collection> {
    await this.getByIdOrThrow(id);
    const collection = await this.repo.setStatus(id, CollectionStatus.DRAFT);
    await this.invalidateListCaches();
    return collection;
  }

  async archiveCollection(id: string): Promise<Collection> {
    await this.getByIdOrThrow(id);
    // Archiving a collection never touches product visibility elsewhere — it only
    // hides this collection page; products remain published via their category.
    const collection = await this.repo.setStatus(id, CollectionStatus.ARCHIVED);
    await this.invalidateListCaches();
    return collection;
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<Collection> {
    await this.getByIdOrThrow(id);
    const collection = await this.repo.setFeatured(id, isFeatured);
    await this.invalidateListCaches();
    return collection;
  }

  async addProduct(collectionId: string, input: AddProductInput, adminId: string): Promise<void> {
    await this.getByIdOrThrow(collectionId);

    const isApproved = await this.repo.isProductApproved(input.productId);
    if (!isApproved) {
      throw AppError.badRequest('Only approved products can be added to a collection');
    }

    const sortOrder = input.sortOrder ?? (await this.repo.countProducts(collectionId));
    await this.repo.addProduct(collectionId, input.productId, sortOrder);
    await writeAuditLog(adminId, 'COLLECTION_PRODUCT_ADDED', 'Collection', collectionId, {
      productId: input.productId,
    });
    await this.invalidateListCaches();
  }

  async removeProduct(collectionId: string, productId: string, adminId: string): Promise<void> {
    await this.getByIdOrThrow(collectionId);
    await this.repo.removeProduct(collectionId, productId);
    await writeAuditLog(adminId, 'COLLECTION_PRODUCT_REMOVED', 'Collection', collectionId, { productId });
    await this.invalidateListCaches();
  }

  async reorderMembership(collectionId: string, items: ReorderMembershipItem[]): Promise<void> {
    await this.getByIdOrThrow(collectionId);
    await this.repo.reorderMembership(collectionId, items);
    await this.invalidateListCaches();
  }

  async listAdmin(filter: AdminCollectionListFilter, pagination: PaginationQuery) {
    return this.repo.findAdminList(filter, pagination);
  }

  async getAdminDetail(id: string) {
    const collection = await this.getByIdOrThrow(id);
    const members = await this.repo.findMembers(id);
    return {
      ...collection,
      products: members.map((m) => ({
        ...m.product,
        sellerPrice: m.product.sellerPrice.toString(),
        adminPrice: m.product.adminPrice ? m.product.adminPrice.toString() : null,
        sortOrder: m.sortOrder,
      })),
    };
  }

  async listPublic(pagination: PaginationQuery) {
    const key = await versionedListKey(this.cache, PUBLIC_LIST_CACHE_NAMESPACE, { ...pagination });
    const cached = await this.cache.get<{ data: Collection[]; total: number }>(key);
    if (cached) return cached;

    const result = await this.repo.findPublicList(pagination);
    await this.cache.set(key, result, PUBLIC_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async listFeatured(limit = 6): Promise<Collection[]> {
    const cached = await this.cache.get<Collection[]>(FEATURED_CACHE_KEY);
    if (cached) return cached;

    const collections = await this.repo.findFeatured(limit);
    await this.cache.set(FEATURED_CACHE_KEY, collections, FEATURED_CACHE_TTL_SECONDS);
    return collections;
  }

  async getPublicDetail(slug: string, pagination: PaginationQuery) {
    const collection = await this.repo.findBySlug(slug);
    if (!collection || !this.repo.isVisible(collection)) {
      throw AppError.notFound('Collection not found');
    }

    const [{ data: products, total }, related] = await Promise.all([
      this.products.listPublished({ collectionId: collection.id }, pagination),
      this.repo.findRelated(collection.id, 4),
    ]);

    return { collection, products, total, related };
  }
}

export const collectionsService = new CollectionsService();
