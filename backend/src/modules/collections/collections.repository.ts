import { Collection, CollectionStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { AdminCollectionListFilter, CreateCollectionInput, UpdateCollectionInput } from './collections.types';

export class CollectionsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<Collection | null> {
    return this.db.collection.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Collection | null> {
    return this.db.collection.findUnique({ where: { slug } });
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.db.collection.count({ where: { slug } });
    return count > 0;
  }

  create(input: CreateCollectionInput & { slug: string }): Promise<Collection> {
    return this.db.collection.create({
      data: {
        name: input.name,
        slug: input.slug,
        heroImage: input.heroImage,
        editorialIntro: input.editorialIntro,
        isFeatured: input.isFeatured ?? false,
        status: input.status ?? CollectionStatus.DRAFT,
        publishAt: input.publishAt,
      },
    });
  }

  update(id: string, input: UpdateCollectionInput): Promise<Collection> {
    return this.db.collection.update({ where: { id }, data: input });
  }

  setStatus(id: string, status: CollectionStatus): Promise<Collection> {
    return this.db.collection.update({ where: { id }, data: { status } });
  }

  setFeatured(id: string, isFeatured: boolean): Promise<Collection> {
    return this.db.collection.update({ where: { id }, data: { isFeatured } });
  }

  async findAdminList(
    filter: AdminCollectionListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: Collection[]; total: number }> {
    const where: Prisma.CollectionWhereInput = filter.status ? { status: filter.status } : {};
    const [data, total] = await Promise.all([
      this.db.collection.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.collection.count({ where }),
    ]);
    return { data, total };
  }

  /** Live/visible = PUBLISHED, or SCHEDULED whose publishAt has already passed. */
  private visibleWhere(): Prisma.CollectionWhereInput {
    return {
      OR: [
        { status: CollectionStatus.PUBLISHED },
        { status: CollectionStatus.SCHEDULED, publishAt: { lte: new Date() } },
      ],
    };
  }

  async findPublicList(pagination: PaginationQuery): Promise<{ data: Collection[]; total: number }> {
    const where = this.visibleWhere();
    const [data, total] = await Promise.all([
      this.db.collection.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.collection.count({ where }),
    ]);
    return { data, total };
  }

  findFeatured(limit: number): Promise<Collection[]> {
    return this.db.collection.findMany({
      where: { ...this.visibleWhere(), isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findRelated(excludeId: string, limit: number): Promise<Collection[]> {
    return this.db.collection.findMany({
      where: { ...this.visibleWhere(), id: { not: excludeId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  isVisible(collection: Collection): boolean {
    if (collection.status === CollectionStatus.PUBLISHED) return true;
    if (collection.status === CollectionStatus.SCHEDULED && collection.publishAt) {
      return collection.publishAt <= new Date();
    }
    return false;
  }

  async addProduct(collectionId: string, productId: string, sortOrder: number): Promise<void> {
    await this.db.productCollection.upsert({
      where: { productId_collectionId: { productId, collectionId } },
      update: { sortOrder },
      create: { collectionId, productId, sortOrder },
    });
  }

  async removeProduct(collectionId: string, productId: string): Promise<void> {
    await this.db.productCollection.deleteMany({ where: { collectionId, productId } });
  }

  async reorderMembership(collectionId: string, items: { productId: string; sortOrder: number }[]): Promise<void> {
    await this.db.$transaction(
      items.map((item) =>
        this.db.productCollection.update({
          where: { productId_collectionId: { productId: item.productId, collectionId } },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  async countProducts(collectionId: string): Promise<number> {
    return this.db.productCollection.count({ where: { collectionId } });
  }

  findMembers(collectionId: string) {
    return this.db.productCollection.findMany({
      where: { collectionId },
      orderBy: { sortOrder: 'asc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sellerPrice: true,
            adminPrice: true,
            approvalStatus: true,
            isPublished: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    });
  }

  async isProductApproved(productId: string): Promise<boolean> {
    const product = await this.db.product.findUnique({
      where: { id: productId },
      select: { approvalStatus: true, deletedAt: true },
    });
    return Boolean(product && product.approvalStatus === 'APPROVED' && !product.deletedAt);
  }
}

export const collectionsRepository = new CollectionsRepository();
