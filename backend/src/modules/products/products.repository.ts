import { Prisma, PrismaClient, Product, ProductApprovalStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import {
  AdminProductListFilter,
  CreateProductInput,
  ProductListFilter,
  ProductWithMedia,
  SellerProductListFilter,
  UpdateProductInput,
  VariantInput,
} from './products.types';

const MEDIA_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  variants: {
    include: {
      attributes: { orderBy: { name: 'asc' as const } },
      priceTiers: { orderBy: { moq: 'asc' as const } },
    },
  },
  priceTiers: { orderBy: { moq: 'asc' as const } },
};

type VariantCreateData = {
  type: string;
  value: string;
  sku?: string;
  sellerPrice?: number;
  moq?: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  imageUrl?: string;
  attributes: { create: { name: string; value: string }[] };
  priceTiers?: { create: { moq: number; sellerPrice: number }[] };
};

function toVariantCreateInput(v: VariantInput): VariantCreateData {
  return {
    type: v.type,
    value: v.value,
    sku: v.sku,
    sellerPrice: v.sellerPrice,
    moq: v.moq,
    stock: v.stock ?? 0,
    status: v.status ?? 'ACTIVE',
    imageUrl: v.imageUrl,
    attributes: {
      create: v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }],
    },
    priceTiers: v.priceTiers?.length ? { create: v.priceTiers } : undefined,
  };
}

export class ProductsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findByIdWithMedia(id: string): Promise<ProductWithMedia | null> {
    return this.db.product.findUnique({ where: { id }, include: MEDIA_INCLUDE });
  }

  findByIdRaw(id: string): Promise<Product | null> {
    return this.db.product.findUnique({ where: { id } });
  }

  findBySlugWithMedia(slug: string): Promise<ProductWithMedia | null> {
    return this.db.product.findUnique({ where: { slug }, include: MEDIA_INCLUDE });
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.db.product.count({ where: { slug } });
    return count > 0;
  }

  create(
    sellerId: string,
    input: CreateProductInput & { slug: string },
    imageUrls: string[],
  ): Promise<ProductWithMedia> {
    return this.db.product.create({
      data: {
        sellerId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        materials: input.materials,
        dimensions: input.dimensions,
        weight: input.weight,
        moq: input.moq,
        declaredStock: input.declaredStock,
        sellerPrice: input.sellerPrice,
        leadTime: input.leadTime,
        certifications: input.certifications,
        tags: input.tags ?? [],
        stepQty: input.stepQty,
        lengthCm: input.lengthCm,
        breadthCm: input.breadthCm,
        heightCm: input.heightCm,
        isHandmade: input.isHandmade,
        placeOfOrigin: input.placeOfOrigin,
        isGITagged: input.isGITagged,
        howItIsMade: input.howItIsMade,
        artisanName: input.artisanName,
        images: { create: imageUrls.map((url, index) => ({ url, sortOrder: index })) },
        variants: input.variants ? { create: input.variants.map(toVariantCreateInput) } : undefined,
        priceTiers: input.priceTiers?.length
          ? { create: input.priceTiers.map(({ moq, sellerPrice }) => ({ moq, sellerPrice })) }
          : undefined,
      },
      include: MEDIA_INCLUDE,
    });
  }

  async update(
    id: string,
    input: UpdateProductInput,
    newImageUrls: string[],
    currentImageCount: number,
  ): Promise<ProductWithMedia> {
    const { variants, removeImageIds, priceTiers, ...scalarFields } = input;

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (removeImageIds && removeImageIds.length > 0) {
      operations.push(
        this.db.productImage.deleteMany({ where: { id: { in: removeImageIds }, productId: id } }),
      );
    }

    if (newImageUrls.length > 0) {
      operations.push(
        this.db.productImage.createMany({
          data: newImageUrls.map((url, index) => ({
            productId: id,
            url,
            sortOrder: currentImageCount + index,
          })),
        }),
      );
    }

    if (variants) {
      // Cascade-deletes each variant's attributes/priceTiers too. Individual creates
      // (not createMany) are required because each variant nests its own attributes
      // and price tiers.
      operations.push(this.db.productVariant.deleteMany({ where: { productId: id } }));
      variants.forEach((v: VariantInput) => {
        operations.push(this.db.productVariant.create({ data: { productId: id, ...toVariantCreateInput(v) } }));
      });
    }

    if (priceTiers !== undefined) {
      operations.push(this.db.productPriceTier.deleteMany({ where: { productId: id } }));
      if (priceTiers.length > 0) {
        operations.push(
          this.db.productPriceTier.createMany({
            data: priceTiers.map(({ moq, sellerPrice }) => ({ productId: id, moq, sellerPrice })),
          }),
        );
      }
    }

    operations.push(this.db.product.update({ where: { id }, data: scalarFields }));

    await this.db.$transaction(operations);

    return this.findByIdWithMedia(id) as Promise<ProductWithMedia>;
  }

  setApproval(
    id: string,
    data: Pick<
      Prisma.ProductUpdateInput,
      'approvalStatus' | 'adminPrice' | 'rejectionReason' | 'isPublished' | 'publishedAt'
    >,
  ): Promise<Product> {
    return this.db.product.update({ where: { id }, data });
  }

  setCategory(id: string, categoryId: string): Promise<Product> {
    return this.db.product.update({ where: { id }, data: { categoryId } });
  }

  setPublished(id: string, isPublished: boolean): Promise<Product> {
    return this.db.product.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? new Date() : undefined },
    });
  }

  setFeatured(id: string, isFeatured: boolean): Promise<Product> {
    return this.db.product.update({ where: { id }, data: { isFeatured } });
  }

  softDelete(id: string): Promise<Product> {
    return this.db.product.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
  }

  async findPublished(
    filter: ProductListFilter,
    pagination: PaginationQuery,
    categoryIds: string[] | undefined,
  ): Promise<{ data: ProductWithMedia[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(filter.collectionId ? { collections: { some: { collectionId: filter.collectionId } } } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
      ...(filter.material ? { materials: { contains: filter.material, mode: 'insensitive' } } : {}),
      ...(filter.moqMax ? { moq: { lte: filter.moqMax } } : {}),
      ...(filter.minPrice || filter.maxPrice
        ? {
            adminPrice: {
              ...(filter.minPrice ? { gte: filter.minPrice } : {}),
              ...(filter.maxPrice ? { lte: filter.maxPrice } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: MEDIA_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.product.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Two-partition pagination: preferred-category products first (by recency), then
   * everything else (featured, then recency) as backfill. Both partitions are ordered
   * deterministically (tiebreak on id) so a page boundary never skips or repeats a
   * product, even though the split is computed from two separate counted queries
   * rather than a single ORDER BY.
   */
  async findRecommended(
    preferredCategoryIds: string[],
    pagination: PaginationQuery,
  ): Promise<{ data: ProductWithMedia[]; total: number }> {
    const baseWhere: Prisma.ProductWhereInput = {
      deletedAt: null,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
    };
    const preferredWhere: Prisma.ProductWhereInput = {
      ...baseWhere,
      categoryId: { in: preferredCategoryIds },
    };
    const otherWhere: Prisma.ProductWhereInput = preferredCategoryIds.length
      ? { ...baseWhere, categoryId: { notIn: preferredCategoryIds } }
      : baseWhere;

    const [preferredCount, otherCount] = await Promise.all([
      preferredCategoryIds.length ? this.db.product.count({ where: preferredWhere }) : Promise.resolve(0),
      this.db.product.count({ where: otherWhere }),
    ]);
    const total = preferredCount + otherCount;
    const { skip, take } = toSkipTake(pagination);

    const data: ProductWithMedia[] = [];

    if (skip < preferredCount) {
      data.push(
        ...(await this.db.product.findMany({
          where: preferredWhere,
          include: MEDIA_INCLUDE,
          orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
          skip,
          take,
        })),
      );
    }

    const remaining = take - data.length;
    if (remaining > 0) {
      data.push(
        ...(await this.db.product.findMany({
          where: otherWhere,
          include: MEDIA_INCLUDE,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
          skip: Math.max(0, skip - preferredCount),
          take: remaining,
        })),
      );
    }

    return { data, total };
  }

  findRelated(categoryId: string, excludeProductId: string, limit: number): Promise<ProductWithMedia[]> {
    return this.db.product.findMany({
      where: {
        categoryId,
        id: { not: excludeProductId },
        deletedAt: null,
        isPublished: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
      },
      include: MEDIA_INCLUDE,
      take: limit,
    });
  }

  async findForSeller(
    sellerId: string,
    filter: SellerProductListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: ProductWithMedia[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      sellerId,
      deletedAt: null,
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: MEDIA_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.product.count({ where }),
    ]);
    return { data, total };
  }

  async findForAdmin(
    filter: AdminProductListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: (ProductWithMedia & { seller: { businessName: string }; category: { name: string } })[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
      ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: {
          ...MEDIA_INCLUDE,
          seller: { select: { businessName: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.product.count({ where }),
    ]);
    return { data, total };
  }
}

export const productsRepository = new ProductsRepository();
