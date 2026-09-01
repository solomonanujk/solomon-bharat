import { Product, ProductApprovalStatus } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { slugify, uniqueSlugSuffix, calculateMargin } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { PaginationQuery } from '../../utils/pagination';
import { cache as defaultCache, bumpVersion, CacheClient, versionedListKey } from '../../utils/cache';
import { prisma } from '../../config/prisma';
import { categoriesService, CategoriesService } from '../categories/categories.service';
import { notificationsService } from '../notifications/notifications.service';
import { reviewsRepository, ReviewsRepository } from '../reviews/reviews.repository';
import { ProductsRepository, productsRepository } from './products.repository';
import {
  AdminProductListFilter,
  AgentProduct,
  BuyerProduct,
  CreateProductInput,
  ProductListFilter,
  ProductWithMedia,
  SellerProduct,
  SellerProductListFilter,
  TierAdminPriceInput,
  UpdateProductInput,
  UploadedImageFile,
} from './products.types';

const MIN_IMAGES = 2;
const MAX_IMAGES = 10;

const OPEN_REVIEW_STATUSES: ProductApprovalStatus[] = [
  ProductApprovalStatus.PENDING,
  ProductApprovalStatus.RESUBMITTED,
];

// NOTE (pre-existing, out of scope here): this passes `variants[].priceTiers` straight
// through, which includes each tier's raw `sellerPrice`/`adminPrice` fields — a leak of
// seller/admin-side data into the buyer projection. Do not repeat this pattern below in
// toAgentProduct, which maps its price tiers down to a minimal safe shape instead.
function toBuyerProduct(
  product: ProductWithMedia,
  rating?: { avgRating: number; reviewCount: number },
): BuyerProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    materials: product.materials,
    dimensions: product.dimensions,
    weight: product.weight,
    moq: product.moq,
    adminPrice: product.adminPrice ? product.adminPrice.toString() : '0',
    leadTime: product.leadTime,
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    publishedAt: product.publishedAt,
    images: product.images,
    variants: product.variants,
    avgRating: rating?.avgRating ?? null,
    reviewCount: rating?.reviewCount ?? 0,
    tags: product.tags,
    stepQty: product.stepQty,
    isHandmade: product.isHandmade,
    placeOfOrigin: product.placeOfOrigin,
    isGITagged: product.isGITagged,
    howItIsMade: product.howItIsMade,
    artisanName: product.artisanName,
  };
}

/**
 * Agent-safe projection, parallel to toBuyerProduct but exposing agentPrice instead of
 * adminPrice. Unlike toBuyerProduct, variant price tiers are mapped down to a minimal
 * {id, moq, agentPrice} shape rather than passed through raw, so sellerPrice/adminPrice
 * never leak into the agent-facing response.
 */
function toAgentProduct(
  product: ProductWithMedia,
  rating?: { avgRating: number; reviewCount: number },
): AgentProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    materials: product.materials,
    dimensions: product.dimensions,
    weight: product.weight,
    moq: product.moq,
    agentPrice: product.agentPrice ? product.agentPrice.toString() : '0',
    leadTime: product.leadTime,
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    publishedAt: product.publishedAt,
    images: product.images,
    variants: product.variants.map((v) => ({
      ...v,
      priceTiers: v.priceTiers.map((t) => ({
        id: t.id,
        moq: t.moq,
        agentPrice: t.agentPrice ? t.agentPrice.toString() : '0',
      })),
    })),
    avgRating: rating?.avgRating ?? null,
    reviewCount: rating?.reviewCount ?? 0,
    tags: product.tags,
    stepQty: product.stepQty,
    isHandmade: product.isHandmade,
    placeOfOrigin: product.placeOfOrigin,
    isGITagged: product.isGITagged,
    howItIsMade: product.howItIsMade,
    artisanName: product.artisanName,
  };
}

function toSellerProduct(product: ProductWithMedia): SellerProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    materials: product.materials,
    dimensions: product.dimensions,
    weight: product.weight,
    moq: product.moq,
    declaredStock: product.declaredStock,
    sellerPrice: product.sellerPrice.toString(),
    leadTime: product.leadTime,
    categoryId: product.categoryId,
    approvalStatus: product.approvalStatus,
    rejectionReason: product.rejectionReason,
    isPublished: product.isPublished,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    images: product.images,
    variants: product.variants,
    priceTiers: product.priceTiers,
    tags: product.tags,
    stepQty: product.stepQty,
    isHandmade: product.isHandmade,
    placeOfOrigin: product.placeOfOrigin,
    isGITagged: product.isGITagged,
    howItIsMade: product.howItIsMade,
    artisanName: product.artisanName,
  };
}

const PUBLISHED_LIST_CACHE_NAMESPACE = 'products:published-list';
// Distinct namespace for the agent-priced variant of the published list — the returned
// prices differ from the buyer version, so the two must never share a cache key.
const PUBLISHED_LIST_CACHE_NAMESPACE_AGENT = 'products:published-list:agent';
const PUBLISHED_LIST_CACHE_TTL_SECONDS = 120;

type PolishableField = 'name' | 'description' | 'tags';

const POLISH_PROMPTS: Record<PolishableField, (value: string) => string> = {
  name: (value) => `You are a proofreader for a B2B wholesale marketplace selling Indian artisan goods.
Correct this product name — fix it, don't rewrite it:
- Fix spelling, grammar, and capitalisation mistakes only
- Use Title Case
- Strip all HTML tags and markup — return plain text only, no tags of any kind
- Remove emojis, stray symbols, and repeated punctuation (keep hyphens if part of the name)
- Collapse extra whitespace
- Keep the author's own words and word order — do NOT rephrase, reword, or substitute synonyms for anything that is already correct
- Do NOT add or invent any words, materials, or details that aren't in the original
- Max 200 characters — only shorten if it's already over, cutting at a natural word boundary

Return ONLY the corrected name, no explanation.

Input: "${value}"`,

  description: (value) => `You are a proofreader for a B2B wholesale marketplace selling Indian artisan goods.
Correct this product description — fix it, don't rewrite it:
- Fix every spelling, grammar, and punctuation mistake so each sentence is grammatically correct
- Strip all HTML tags and markup — return plain text only, no tags of any kind
- Remove emojis, stray symbols, and repeated punctuation
- Fix spacing: collapse multiple blank lines to one, remove trailing spaces
- Standardise bullet points to a single style ("-") if any are used
- Keep the author's own words, sentence order, and level of detail — do NOT rephrase sentences that are already correct, do NOT add adjectives or marketing language that isn't there, do NOT remove or reorganise content
- Do NOT add, remove, or invent any factual claims (materials, dimensions, origin, etc.)
- The result should read as the same description, just correctly written

Return ONLY the corrected description, no explanation.

Input:
${value}`,

  tags: (value) => `You are cleaning up product tags for a B2B wholesale marketplace.
Correct this list of tags — fix each one, don't replace it with a different word:
- Fix spelling mistakes in each tag
- Lowercase everything
- Strip any HTML tags or markup from each tag — return plain text only
- Remove emojis and special characters from each tag
- Trim whitespace around each tag
- Split any tag that's really multiple keywords crammed together
- Remove exact and near-duplicate tags (case-insensitive, singular/plural)
- Keep at most 10 tags — keep the most relevant/specific ones if trimming
- Do NOT add new tags that aren't implied by the input
- Return as comma-separated values only

Return ONLY the comma-separated tags, no explanation.

Input: "${value}"`,
};

export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository = productsRepository,
    private readonly categories: CategoriesService = categoriesService,
    private readonly cache: CacheClient = defaultCache,
    private readonly reviews: ReviewsRepository = reviewsRepository,
  ) {}

  private async invalidatePublishedListCache(): Promise<void> {
    await Promise.all([
      bumpVersion(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE),
      bumpVersion(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE_AGENT),
    ]);
  }

  /**
   * Internal, service-to-service only — returns raw seller+admin pricing together so the
   * orders module can compute per-line margins at checkout. Never routed via a controller;
   * every public-facing method on this class strips one side or the other.
   */
  async getForCheckout(productId: string): Promise<ProductWithMedia> {
    const product = await this.repo.findByIdWithMedia(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    return product;
  }

  private async getOwnedProductOrThrow(sellerProfileId: string, productId: string): Promise<Product> {
    const product = await this.repo.findByIdRaw(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    if (product.sellerId !== sellerProfileId) {
      throw AppError.forbidden('You do not have access to this product');
    }
    return product;
  }

  private async getProductOrThrow(productId: string): Promise<Product> {
    const product = await this.repo.findByIdRaw(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    return product;
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

  private async uploadImages(files: UploadedImageFile[]): Promise<string[]> {
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadImage(file.buffer, `${Date.now()}-${index}-${file.originalname}`, 'products'),
      ),
    );
    return uploads.map((u) => u.url);
  }

  async createProduct(
    sellerProfileId: string,
    input: CreateProductInput,
    files: UploadedImageFile[],
  ): Promise<SellerProduct> {
    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    await this.categories.assertValidLeafCategory(input.categoryId);

    const slug = await this.generateUniqueSlug(input.name);
    const imageUrls = await this.uploadImages(files);

    const product = await this.repo.create(sellerProfileId, { ...input, slug }, imageUrls);
    await this.invalidatePublishedListCache();
    return toSellerProduct(product);
  }

  async updateProduct(
    sellerProfileId: string,
    productId: string,
    input: UpdateProductInput,
    files: UploadedImageFile[],
  ): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);

    if (product.approvalStatus === ProductApprovalStatus.APPROVED) {
      throw AppError.badRequest('An approved product cannot be edited directly — contact support');
    }

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    const imageUrls = await this.uploadImages(files);
    const updated = await this.repo.update(productId, input, imageUrls, currentImageCount - removedCount);
    await this.invalidatePublishedListCache();
    return toSellerProduct(updated);
  }

  async resubmitProduct(sellerProfileId: string, productId: string): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);

    if (product.approvalStatus !== ProductApprovalStatus.REJECTED) {
      throw AppError.badRequest('Only a rejected product can be resubmitted');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.RESUBMITTED,
      rejectionReason: null,
    });
    await this.invalidatePublishedListCache();
    const withMedia = await this.repo.findByIdWithMedia(updated.id);
    return toSellerProduct(withMedia as ProductWithMedia);
  }

  async deleteProduct(sellerProfileId: string, productId: string): Promise<void> {
    await this.getOwnedProductOrThrow(sellerProfileId, productId);
    await this.repo.softDelete(productId);
    await this.invalidatePublishedListCache();
  }

  /**
   * Admin sets a price per seller MOQ tier rather than one flat price — this writes
   * the given tiers' adminPrice/agentPrice (product-level flat tiers, or each
   * variant's own tiers), then derives the product-level Product.adminPrice and
   * Product.agentPrice, each independently, as the cheapest tier priced for that
   * side across whichever set applies (a given tier may only have one of the two
   * set) — the same way Product.sellerPrice/moq are derived from the seller's
   * cheapest tier on the frontend.
   */
  private async applyTierAdminPrices(
    productId: string,
    priceTiers: TierAdminPriceInput[] = [],
    variantPriceTiers: TierAdminPriceInput[] = [],
  ): Promise<{ adminPrice: number | null; agentPrice: number | null }> {
    const product = await this.repo.findByIdWithMedia(productId);
    if (!product) throw AppError.notFound('Product not found');

    const validTierIds = new Set(product.priceTiers.map((t) => t.id));
    const validVariantTierIds = new Set(product.variants.flatMap((v) => v.priceTiers.map((t) => t.id)));

    for (const t of priceTiers) {
      if (!validTierIds.has(t.id)) throw AppError.badRequest(`Price tier ${t.id} does not belong to this product`);
    }
    for (const t of variantPriceTiers) {
      if (!validVariantTierIds.has(t.id)) {
        throw AppError.badRequest(`Variant price tier ${t.id} does not belong to this product`);
      }
    }

    await this.repo.updateProductTierAdminPrices(priceTiers);
    await this.repo.updateVariantTierAdminPrices(variantPriceTiers);

    const updateById = new Map([...priceTiers, ...variantPriceTiers].map((t) => [t.id, t]));
    const allTiers = [
      ...product.priceTiers,
      ...product.variants.flatMap((v) => v.priceTiers),
    ];

    const cheapestOf = (field: 'adminPrice' | 'agentPrice'): number | null => {
      const prices = allTiers
        .map((t) => {
          const update = updateById.get(t.id)?.[field];
          if (update !== undefined) return update;
          return t[field] != null ? Number(t[field]) : null;
        })
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b);
      return prices[0] ?? null;
    };

    const adminPrice = cheapestOf('adminPrice');
    const agentPrice = cheapestOf('agentPrice');

    if (adminPrice == null && agentPrice == null) {
      throw AppError.badRequest('Set an admin price or agent price for at least one tier');
    }
    return { adminPrice, agentPrice };
  }

  async approveProduct(
    productId: string,
    priceTiers: TierAdminPriceInput[] | undefined,
    variantPriceTiers: TierAdminPriceInput[] | undefined,
    adminId: string,
  ): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (!OPEN_REVIEW_STATUSES.includes(product.approvalStatus)) {
      throw AppError.badRequest('Only a pending or resubmitted product can be approved');
    }

    const { adminPrice, agentPrice } = await this.applyTierAdminPrices(productId, priceTiers, variantPriceTiers);

    // Approval/publish gating depends only on adminPrice resolving — a product can be
    // approved and published for buyers before an agent price is ever set.
    if (adminPrice == null) {
      throw AppError.badRequest('Set an admin price for at least one tier to approve this product');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.APPROVED,
      adminPrice,
      agentPrice: agentPrice ?? undefined,
      rejectionReason: null,
      isPublished: true,
      publishedAt: new Date(),
    });

    await writeAuditLog(adminId, 'PRODUCT_APPROVED', 'Product', productId, { adminPrice, agentPrice });
    await this.invalidatePublishedListCache();

    const sellerUserId = await this.getSellerUserId(updated.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyProductApproved(sellerUserId, updated.name);
    }

    return updated;
  }

  private async getSellerUserId(sellerProfileId: string): Promise<string | null> {
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerProfileId },
      select: { userId: true },
    });
    return seller?.userId ?? null;
  }

  async rejectProduct(productId: string, reason: string, adminId: string): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (!OPEN_REVIEW_STATUSES.includes(product.approvalStatus)) {
      throw AppError.badRequest('Only a pending or resubmitted product can be rejected');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.REJECTED,
      rejectionReason: reason,
      isPublished: false,
    });

    await writeAuditLog(adminId, 'PRODUCT_REJECTED', 'Product', productId, { reason });
    await this.invalidatePublishedListCache();

    const sellerUserId = await this.getSellerUserId(updated.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyProductRejected(sellerUserId, updated.name, reason);
    }

    return updated;
  }

  async updatePrice(
    productId: string,
    priceTiers: TierAdminPriceInput[] | undefined,
    variantPriceTiers: TierAdminPriceInput[] | undefined,
    adminId: string,
  ): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.badRequest('Only an approved product has a selling price to update');
    }

    const { adminPrice, agentPrice } = await this.applyTierAdminPrices(productId, priceTiers, variantPriceTiers);

    const updated = await this.repo.setApproval(productId, {
      adminPrice: adminPrice ?? undefined,
      agentPrice: agentPrice ?? undefined,
    });
    await writeAuditLog(adminId, 'PRODUCT_PRICE_CHANGED', 'Product', productId, {
      previousAdminPrice: product.adminPrice?.toString(),
      newAdminPrice: adminPrice,
      previousAgentPrice: product.agentPrice?.toString(),
      newAgentPrice: agentPrice,
    });
    await this.invalidatePublishedListCache();
    return updated;
  }

  async reassignCategory(productId: string, categoryId: string, adminId: string): Promise<Product> {
    await this.getProductOrThrow(productId);
    await this.categories.assertValidLeafCategory(categoryId);

    const updated = await this.repo.setCategory(productId, categoryId);
    await writeAuditLog(adminId, 'PRODUCT_CATEGORY_REASSIGNED', 'Product', productId, { categoryId });
    await this.invalidatePublishedListCache();
    return updated;
  }

  async setPublished(productId: string, isPublished: boolean): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (isPublished && (product.approvalStatus !== ProductApprovalStatus.APPROVED || !product.adminPrice)) {
      throw AppError.badRequest('Only an approved product with a selling price can be published');
    }
    const updated = await this.repo.setPublished(productId, isPublished);
    await this.invalidatePublishedListCache();
    return updated;
  }

  async setFeatured(productId: string, isFeatured: boolean): Promise<Product> {
    await this.getProductOrThrow(productId);
    const updated = await this.repo.setFeatured(productId, isFeatured);
    await this.invalidatePublishedListCache();
    return updated;
  }

  async listPublished(filter: ProductListFilter, pagination: PaginationQuery) {
    if (!filter.categoryId && !filter.collectionId) {
      throw AppError.badRequest('A category or collection scope is required for product search');
    }

    const key = await versionedListKey(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE, {
      ...filter,
      ...pagination,
    });
    const cached = await this.cache.get<{ data: BuyerProduct[]; total: number }>(key);
    if (cached) return cached;

    const categoryIds = filter.categoryId
      ? await this.categories.getLeafDescendantIds(filter.categoryId)
      : undefined;

    const { data, total } = await this.repo.findPublished(filter, pagination, categoryIds);
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    const result = { data: data.map((p) => toBuyerProduct(p, ratings.get(p.id))), total };
    await this.cache.set(key, result, PUBLISHED_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Agent-facing equivalent of listPublished — same query/repository path, priced with
   * agentPrice instead of adminPrice, cached under a distinct namespace. Unlike the buyer
   * listing, this is deliberately NOT scoped to a category/collection: an agent browses
   * the whole catalog to build a reseller catalogue, not a category-first storefront.
   */
  async listPublishedForAgent(filter: ProductListFilter, pagination: PaginationQuery) {
    const key = await versionedListKey(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE_AGENT, {
      ...filter,
      ...pagination,
    });
    const cached = await this.cache.get<{ data: AgentProduct[]; total: number }>(key);
    if (cached) return cached;

    const categoryIds = filter.categoryId
      ? await this.categories.getLeafDescendantIds(filter.categoryId)
      : undefined;

    const { data, total } = await this.repo.findPublished(filter, pagination, categoryIds, 'agentPrice');
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    const result = { data: data.map((p) => toAgentProduct(p, ratings.get(p.id))), total };
    await this.cache.set(key, result, PUBLISHED_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  /** Distinct categoryIds from the buyer's wishlist and past order items — the signal used to bias recommendations. */
  private async getPreferredCategoryIds(buyerId: string): Promise<string[]> {
    const [wishlisted, ordered] = await Promise.all([
      prisma.wishlistItem.findMany({
        where: { buyerId },
        select: { product: { select: { categoryId: true } } },
      }),
      prisma.orderItem.findMany({
        where: { order: { buyerId } },
        select: { product: { select: { categoryId: true } } },
        distinct: ['productId'],
      }),
    ]);

    const categoryIds = new Set<string>();
    wishlisted.forEach((w) => categoryIds.add(w.product.categoryId));
    ordered.forEach((o) => categoryIds.add(o.product.categoryId));
    return Array.from(categoryIds);
  }

  /**
   * Personalized buyer home feed — the one deliberate exception to "no unscoped
   * product browsing": biased toward the buyer's wishlist/order-history categories,
   * backfilled with featured/recent products so every buyer always gets a full feed.
   */
  async getRecommendationsForBuyer(buyerId: string, pagination: PaginationQuery) {
    const preferredCategoryIds = await this.getPreferredCategoryIds(buyerId);
    const { data, total } = await this.repo.findRecommended(preferredCategoryIds, pagination);
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    return { data: data.map((p) => toBuyerProduct(p, ratings.get(p.id))), total };
  }

  async getBySlug(slug: string): Promise<{ product: BuyerProduct; related: BuyerProduct[] }> {
    const product = await this.repo.findBySlugWithMedia(slug);
    if (!product || product.deletedAt || !product.isPublished || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.notFound('Product not found');
    }

    const related = await this.repo.findRelated(product.categoryId, product.id, 4);
    const ratings = await this.reviews.getRatingSummaries([product.id, ...related.map((p) => p.id)]);
    return {
      product: toBuyerProduct(product, ratings.get(product.id)),
      related: related.map((p) => toBuyerProduct(p, ratings.get(p.id))),
    };
  }

  /** Agent-facing equivalent of getBySlug — same lookup, priced with agentPrice instead of adminPrice. */
  async getBySlugForAgent(slug: string): Promise<{ product: AgentProduct; related: AgentProduct[] }> {
    const product = await this.repo.findBySlugWithMedia(slug);
    if (
      !product ||
      product.deletedAt ||
      !product.isPublished ||
      product.approvalStatus !== ProductApprovalStatus.APPROVED ||
      !product.agentPrice
    ) {
      throw AppError.notFound('Product not found');
    }

    const related = await this.repo.findRelated(product.categoryId, product.id, 4);
    const ratings = await this.reviews.getRatingSummaries([product.id, ...related.map((p) => p.id)]);
    return {
      product: toAgentProduct(product, ratings.get(product.id)),
      related: related.map((p) => toAgentProduct(p, ratings.get(p.id))),
    };
  }

  async listForSeller(
    sellerProfileId: string,
    filter: SellerProductListFilter,
    pagination: PaginationQuery,
  ) {
    const { data, total } = await this.repo.findForSeller(sellerProfileId, filter, pagination);
    return { data: data.map(toSellerProduct), total };
  }

  async listForAdmin(filter: AdminProductListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findForAdmin(filter, pagination);
    return {
      data: data.map((product) => ({
        ...product,
        sellerPrice: product.sellerPrice.toString(),
        adminPrice: product.adminPrice ? product.adminPrice.toString() : null,
        agentPrice: product.agentPrice ? product.agentPrice.toString() : null,
        margin: product.adminPrice
          ? calculateMargin(Number(product.adminPrice), Number(product.sellerPrice))
          : null,
      })),
      total,
    };
  }

  async getForSeller(sellerProfileId: string, productId: string): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);
    const withMedia = await this.repo.findByIdWithMedia(product.id);
    return toSellerProduct(withMedia as ProductWithMedia);
  }

  /** AI content polish (Gemini) — proofreads name/description/tags without rewriting them. */
  async polishField(field: PolishableField, value: string): Promise<string> {
    if (!value.trim()) return value;
    if (!env.GEMINI_API_KEY) throw AppError.badRequest('AI polishing is not configured');

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(POLISH_PROMPTS[field](value));
    // Belt-and-braces: strip any HTML tags the model leaves behind despite the
    // prompt instruction, so markup can never make it into stored content.
    return result.response.text().trim().replace(/<[^>]*>/g, '').trim();
  }

  async getForAdmin(productId: string) {
    const product = await this.repo.findByIdWithMedia(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    return {
      ...product,
      sellerPrice: product.sellerPrice.toString(),
      adminPrice: product.adminPrice ? product.adminPrice.toString() : null,
      agentPrice: product.agentPrice ? product.agentPrice.toString() : null,
      margin: product.adminPrice
        ? calculateMargin(Number(product.adminPrice), Number(product.sellerPrice))
        : null,
    };
  }
}

export const productsService = new ProductsService();
