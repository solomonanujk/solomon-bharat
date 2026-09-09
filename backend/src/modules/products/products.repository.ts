import { OrderStatus, Prisma, PrismaClient, Product, ProductApprovalStatus, ProductPricingChangeRequest } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import {
  AdminProductListFilter,
  ApplyPricingChangeInput,
  CreateProductInput,
  ProductListFilter,
  ProductWithMedia,
  ProposedPricing,
  SellerProductListFilter,
  TierAdminPriceInput,
  UpdateProductInput,
  VariantInputWithAdminPricing,
} from './products.types';

const TRENDING_WINDOW_DAYS = 30;

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
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  imageUrl?: string;
  attributes: { create: { name: string; value: string }[] };
  priceTiers?: { create: { moq: number; sellerPrice: number; adminPrice?: number; agentPrice?: number }[] };
};

// Accepts a plain VariantInput (no admin/agent pricing — the create/direct-edit path)
// or a VariantInputWithAdminPricing (the approved-pricing-change path, where each tier
// already carries the admin's just-set adminPrice/agentPrice) — a plain VariantInput's
// tiers are structurally assignable here since adminPrice/agentPrice are optional.
function toVariantCreateInput(v: VariantInputWithAdminPricing): VariantCreateData {
  return {
    type: v.type,
    value: v.value,
    sku: v.sku,
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
    // Present only for the admin-create path (createProductAsAdmin) — the plain
    // seller-submit path leaves this undefined and gets the schema defaults
    // (PENDING/unpublished, no adminPrice/agentPrice).
    overrides?: {
      approvalStatus: ProductApprovalStatus;
      isPublished: boolean;
      publishedAt: Date;
      adminPrice: number | null;
      agentPrice: number | null;
    },
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
        tags: input.tags ?? [],
        stepQty: input.stepQty,
        isHandmade: input.isHandmade,
        placeOfOrigin: input.placeOfOrigin,
        isGITagged: input.isGITagged,
        howItIsMade: input.howItIsMade,
        artisanName: input.artisanName,
        ...overrides,
        images: { create: imageUrls.map((url, index) => ({ url, sortOrder: index })) },
        variants: input.variants ? { create: input.variants.map(toVariantCreateInput) } : undefined,
        priceTiers: input.priceTiers?.length
          ? {
              create: input.priceTiers.map(({ moq, sellerPrice, adminPrice, agentPrice }) => ({
                moq,
                sellerPrice,
                adminPrice,
                agentPrice,
              })),
            }
          : undefined,
      },
      include: MEDIA_INCLUDE,
    });
  }

  // Shared by update() (direct edit) and applyPricingChange() (approved-change apply)
  // — the only difference between the two call sites is whether each tier already
  // carries an adminPrice/agentPrice (a plain VariantInput/PriceTierInput's tiers are
  // structurally fine here too, since those fields are optional on the wider type).
  private pushPricingReplaceOps(
    operations: Prisma.PrismaPromise<unknown>[],
    productId: string,
    data: {
      variants?: VariantInputWithAdminPricing[];
      priceTiers?: { moq: number; sellerPrice: number; adminPrice?: number; agentPrice?: number }[];
    },
  ): void {
    if (data.variants !== undefined) {
      // Cascade-deletes each variant's attributes/priceTiers too. Individual creates
      // (not createMany) are required because each variant nests its own attributes
      // and price tiers.
      operations.push(this.db.productVariant.deleteMany({ where: { productId } }));
      data.variants.forEach((v) => {
        operations.push(this.db.productVariant.create({ data: { productId, ...toVariantCreateInput(v) } }));
      });
    }

    if (data.priceTiers !== undefined) {
      operations.push(this.db.productPriceTier.deleteMany({ where: { productId } }));
      if (data.priceTiers.length > 0) {
        operations.push(
          this.db.productPriceTier.createMany({
            data: data.priceTiers.map((t) => ({
              productId,
              moq: t.moq,
              sellerPrice: t.sellerPrice,
              adminPrice: t.adminPrice,
              agentPrice: t.agentPrice,
            })),
          }),
        );
      }
    }
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

    this.pushPricingReplaceOps(operations, id, { variants, priceTiers });

    operations.push(this.db.product.update({ where: { id }, data: scalarFields }));

    await this.db.$transaction(operations);

    return this.findByIdWithMedia(id) as Promise<ProductWithMedia>;
  }

  // ─── Staged pricing/variant changes on an already-approved product ────────────

  findPendingPricingChange(productId: string): Promise<ProductPricingChangeRequest | null> {
    return this.db.productPricingChangeRequest.findFirst({ where: { productId, status: 'PENDING' } });
  }

  /** Batched lookup for a seller's product list — one query instead of N. */
  findPendingPricingChangesForProductIds(productIds: string[]): Promise<ProductPricingChangeRequest[]> {
    if (productIds.length === 0) return Promise.resolve([]);
    return this.db.productPricingChangeRequest.findMany({ where: { productId: { in: productIds }, status: 'PENDING' } });
  }

  findPricingChangeById(id: string): Promise<ProductPricingChangeRequest | null> {
    return this.db.productPricingChangeRequest.findUnique({ where: { id } });
  }

  /** Replace semantics: a seller re-saving pricing while one is already pending just
   *  overwrites their previous proposal — no separate "amend" endpoint needed. */
  async upsertPendingPricingChange(productId: string, proposed: ProposedPricing): Promise<ProductPricingChangeRequest> {
    await this.db.productPricingChangeRequest.deleteMany({ where: { productId, status: 'PENDING' } });
    return this.db.productPricingChangeRequest.create({
      data: {
        productId,
        proposedMoq: proposed.moq,
        proposedSellerPrice: proposed.sellerPrice,
        proposedPriceTiers: proposed.priceTiers as unknown as Prisma.InputJsonValue,
        proposedVariants: proposed.variants as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findPendingPricingChanges(
    pagination: PaginationQuery,
  ): Promise<{ data: (ProductPricingChangeRequest & { product: { id: string; name: string; slug: string } })[]; total: number }> {
    const where: Prisma.ProductPricingChangeRequestWhereInput = { status: 'PENDING' };
    const [data, total] = await Promise.all([
      this.db.productPricingChangeRequest.findMany({
        where,
        include: { product: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        ...toSkipTake(pagination),
      }),
      this.db.productPricingChangeRequest.count({ where }),
    ]);
    return { data, total };
  }

  /** Atomically replaces the live variants/tiers with the approved proposal — each
   *  tier's adminPrice/agentPrice is already merged in by the service before this is
   *  called, so there's never a moment where a new tier is live without a price. */
  async applyPricingChange(
    productId: string,
    changeRequestId: string,
    data: ApplyPricingChangeInput,
    reviewedById: string,
  ): Promise<ProductWithMedia> {
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    this.pushPricingReplaceOps(operations, productId, { variants: data.variants, priceTiers: data.priceTiers });

    operations.push(
      this.db.product.update({
        where: { id: productId },
        data: { moq: data.moq, sellerPrice: data.sellerPrice, adminPrice: data.adminPrice, agentPrice: data.agentPrice },
      }),
    );
    operations.push(
      this.db.productPricingChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'APPROVED', reviewedById, reviewedAt: new Date() },
      }),
    );

    await this.db.$transaction(operations);
    return this.findByIdWithMedia(productId) as Promise<ProductWithMedia>;
  }

  setPricingChangeRejected(
    id: string,
    data: { reason: string; reviewedById: string },
  ): Promise<ProductPricingChangeRequest> {
    return this.db.productPricingChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: data.reason,
        reviewedById: data.reviewedById,
        reviewedAt: new Date(),
      },
    });
  }

  setApproval(
    id: string,
    data: Pick<
      Prisma.ProductUpdateInput,
      'approvalStatus' | 'adminPrice' | 'agentPrice' | 'rejectionReason' | 'isPublished' | 'publishedAt'
    >,
  ): Promise<Product> {
    return this.db.product.update({ where: { id }, data });
  }

  async updateProductTierAdminPrices(updates: TierAdminPriceInput[]): Promise<void> {
    if (!updates.length) return;
    await this.db.$transaction(
      updates.map((u) =>
        this.db.productPriceTier.update({
          where: { id: u.id },
          // Prisma silently ignores `undefined` fields, so a per-tier update may carry
          // adminPrice only, agentPrice only, or both without extra branching here.
          data: { adminPrice: u.adminPrice, agentPrice: u.agentPrice },
        }),
      ),
    );
  }

  async updateVariantTierAdminPrices(updates: TierAdminPriceInput[]): Promise<void> {
    if (!updates.length) return;
    await this.db.$transaction(
      updates.map((u) =>
        this.db.variantPriceTier.update({
          where: { id: u.id },
          data: { adminPrice: u.adminPrice, agentPrice: u.agentPrice },
        }),
      ),
    );
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
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
              { materials: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filter.material ? { materials: { contains: filter.material, mode: 'insensitive' } } : {}),
      ...(filter.moqMax ? { moq: { lte: filter.moqMax } } : {}),
      // "newest" needs no extra filter — the default orderBy below is already
      // createdAt desc, so it's just the unscoped catalog in that natural order.
      ...(filter.sort === 'featured' ? { isFeatured: true } : {}),
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
   * "Trending" = real order volume, not a proxy like view count (we don't track those) —
   * total quantity ordered per product over a trailing window, among orders that actually
   * progressed (excludes PENDING_PAYMENT, which may never complete, and CANCELLED).
   * Prisma can't ORDER BY an aggregated relation in a single findMany, so this runs the
   * ranking as a groupBy over OrderItem, then fetches the winning products by id and
   * re-applies that order — a second, unavoidable round-trip, but a small one at our volume.
   */
  async findTrending(
    pagination: PaginationQuery,
  ): Promise<{ data: ProductWithMedia[]; total: number }> {
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const ranked = await this.db.orderItem.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: since },
        order: { status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] } },
        product: {
          deletedAt: null,
          isPublished: true,
          approvalStatus: ProductApprovalStatus.APPROVED,
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
    });

    const total = ranked.length;
    const { skip, take } = toSkipTake(pagination);
    const pageIds = ranked.slice(skip, skip + take).map((r) => r.productId);
    if (pageIds.length === 0) return { data: [], total };

    const products = await this.db.product.findMany({
      where: { id: { in: pageIds } },
      include: MEDIA_INCLUDE,
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const data = pageIds.map((id) => byId.get(id)).filter((p): p is ProductWithMedia => !!p);
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
