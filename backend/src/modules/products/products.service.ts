import { Product, ProductApprovalStatus, ProductPricingChangeRequest, Role } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { slugify, uniqueSlugSuffix, calculateMargin, entityFolder } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { PaginationQuery } from '../../utils/pagination';
import { cache as defaultCache, bumpVersion, CacheClient, versionedListKey } from '../../utils/cache';
import { prisma } from '../../config/prisma';
import { categoriesService, CategoriesService } from '../categories/categories.service';
import { notificationsService } from '../notifications/notifications.service';
import { sellersService } from '../sellers/sellers.service';
import { reviewsRepository, ReviewsRepository } from '../reviews/reviews.repository';
import { ProductsRepository, productsRepository } from './products.repository';
import {
  AdminProductListFilter,
  ApplyPricingChangeInput,
  BuyerProduct,
  CreateProductInput,
  PendingPricingChange,
  PriceTierInput,
  ProductListFilter,
  ProductWithMedia,
  ProposedPricing,
  SellerProduct,
  SellerProductListFilter,
  TierAdminPriceInput,
  UpdateProductInput,
  UploadedImageFile,
  VariantInput,
} from './products.types';

const MIN_IMAGES = 2;
const MAX_IMAGES = 10;

const OPEN_REVIEW_STATUSES: ProductApprovalStatus[] = [
  ProductApprovalStatus.PENDING,
  ProductApprovalStatus.RESUBMITTED,
];

// NOTE (pre-existing, out of scope here): this passes `variants[].priceTiers` straight
// through, which includes each tier's raw `sellerPrice`/`adminPrice`/`agentPrice`
// fields — a leak of seller/admin-side data into the buyer projection.
function toBuyerProduct(
  product: ProductWithMedia,
  rating?: { avgRating: number; reviewCount: number },
  viewerRole?: Role,
): BuyerProduct {
  const isAgent = viewerRole === Role.AGENT;
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
    // Only populated for an authenticated AGENT viewer — never sent to buyers.
    agentPrice: isAgent && product.agentPrice ? product.agentPrice.toString() : null,
    priceTiers: product.priceTiers
      .filter((t) => t.adminPrice != null || t.agentPrice != null)
      .map((t) => ({
        id: t.id,
        moq: t.moq,
        adminPrice: t.adminPrice ? t.adminPrice.toString() : '0',
        agentPrice: isAgent && t.agentPrice ? t.agentPrice.toString() : null,
      })),
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

function toSellerProduct(product: ProductWithMedia, pendingPricingChange: PendingPricingChange | null): SellerProduct {
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
    pendingPricingChange,
  };
}

function toPendingPricingChange(row: ProductPricingChangeRequest): PendingPricingChange {
  return {
    id: row.id,
    proposedMoq: row.proposedMoq,
    proposedSellerPrice: row.proposedSellerPrice.toString(),
    proposedPriceTiers: row.proposedPriceTiers as unknown as PriceTierInput[],
    proposedVariants: row.proposedVariants as unknown as VariantInput[],
    createdAt: row.createdAt,
  };
}

// ─── Comparing a proposed pricing/variant edit against what's currently live ────
// The frontend always resends moq/sellerPrice/priceTiers/variants on every save
// (they're derived state, not something a seller explicitly opts into changing), so
// without this check every unrelated-field edit to an approved product would also
// spawn a pending pricing-change request. Deliberately compares every field
// (including sku/status/imageUrl) rather than just moq/price, so a real edit is
// never silently dropped just because the "price" part of it happens to match.

function normalizeTiers(tiers: { moq: number; sellerPrice: number | string | { toString(): string } }[]): string {
  return JSON.stringify(
    [...tiers]
      .map((t) => ({ moq: t.moq, sellerPrice: Number(t.sellerPrice) }))
      .sort((a, b) => a.moq - b.moq || a.sellerPrice - b.sellerPrice),
  );
}

function normalizeVariants(
  variants: {
    type: string;
    value: string;
    sku?: string | null;
    status?: string | null;
    imageUrl?: string | null;
    attributes?: { name: string; value: string }[];
    priceTiers?: { moq: number; sellerPrice: number | string | { toString(): string } }[];
  }[],
): string {
  return JSON.stringify(
    variants
      .map((v) => ({
        type: v.type,
        value: v.value,
        sku: v.sku ?? null,
        status: v.status ?? 'ACTIVE',
        imageUrl: v.imageUrl ?? null,
        attributes: [...(v.attributes ?? [])].sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value)),
        priceTiers: normalizeTiers(v.priceTiers ?? []),
      }))
      .sort((a, b) => `${a.type}|${a.value}`.localeCompare(`${b.type}|${b.value}`)),
  );
}

function pricingPayloadsEqual(current: ProductWithMedia, proposed: ProposedPricing): boolean {
  if (current.moq !== proposed.moq) return false;
  if (Number(current.sellerPrice) !== proposed.sellerPrice) return false;
  if (normalizeTiers(current.priceTiers) !== normalizeTiers(proposed.priceTiers)) return false;
  if (normalizeVariants(current.variants) !== normalizeVariants(proposed.variants)) return false;
  return true;
}

const PUBLISHED_LIST_CACHE_NAMESPACE = 'products:published-list';
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
    await bumpVersion(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE);
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

  private async uploadImages(files: UploadedImageFile[], folder: string): Promise<string[]> {
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadImage(file.buffer, `${Date.now()}-${index}-${file.originalname}`, folder),
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
    const id = randomUUID();
    const imageUrls = await this.uploadImages(files, entityFolder('products', slug, id));

    const product = await this.repo.create(sellerProfileId, { ...input, slug, id }, imageUrls);
    await this.invalidatePublishedListCache();
    return toSellerProduct(product, null);
  }

  /**
   * Admin creates a product directly — either "on behalf of" a real onboarded seller,
   * or as admin's own (house-sourced) inventory. Either way, admin sets sellerPrice AND
   * adminPrice AND agentPrice per tier right here, so the product skips PENDING review
   * entirely and goes straight to APPROVED + published (admin is both submitter and
   * approver in this flow — a separate later approval step would be pointless).
   */
  async createProductAsAdmin(
    sellerMode: 'existing' | 'house',
    sellerId: string | undefined,
    input: CreateProductInput,
    files: UploadedImageFile[],
    adminId: string,
  ) {
    const sellerProfileId =
      sellerMode === 'existing'
        ? (await sellersService.getSellerDetailForAdmin(sellerId!)).id
        : await sellersService.getOrCreateHouseSellerProfile();

    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    await this.categories.assertValidLeafCategory(input.categoryId);

    const slug = await this.generateUniqueSlug(input.name);
    const id = randomUUID();
    const imageUrls = await this.uploadImages(files, entityFolder('products', slug, id));

    const allTiers = [
      ...(input.priceTiers ?? []),
      ...(input.variants ?? []).flatMap((v) => v.priceTiers ?? []),
    ];
    const cheapestOf = (field: 'adminPrice' | 'agentPrice'): number | null => {
      const prices = allTiers
        .map((t) => t[field])
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b);
      return prices[0] ?? null;
    };
    const adminPrice = cheapestOf('adminPrice');
    const agentPrice = cheapestOf('agentPrice');

    if (adminPrice == null) {
      throw AppError.badRequest('Set a buyer price for at least one tier to publish this product');
    }

    const product = await this.repo.create(sellerProfileId, { ...input, slug, id }, imageUrls, {
      approvalStatus: ProductApprovalStatus.APPROVED,
      isPublished: true,
      publishedAt: new Date(),
      adminPrice,
      agentPrice,
    });

    await writeAuditLog(adminId, 'PRODUCT_CREATED_BY_ADMIN', 'Product', product.id, { sellerMode });
    await this.invalidatePublishedListCache();
    return this.getForAdmin(product.id);
  }

  private async toSellerProductWithPending(product: ProductWithMedia): Promise<SellerProduct> {
    const pending = await this.repo.findPendingPricingChange(product.id);
    return toSellerProduct(product, pending ? toPendingPricingChange(pending) : null);
  }

  /**
   * Once a product is APPROVED (live to buyers), pricing/variant edits (moq,
   * sellerPrice, priceTiers, variants — moq/sellerPrice are themselves derived from
   * the cheapest tier, so they travel with the tier data) no longer apply directly:
   * they're staged as a ProductPricingChangeRequest instead, so buyers keep seeing
   * the last-approved pricing/variants until an admin reviews and re-prices the
   * change. Everything else (name, description, images, materials, etc.) still
   * applies immediately, exactly like editing a not-yet-approved product.
   */
  async updateProduct(
    sellerProfileId: string,
    productId: string,
    input: UpdateProductInput,
    files: UploadedImageFile[],
  ): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    const imageUrls = await this.uploadImages(files, entityFolder('products', product.slug, productId));

    if (product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      // Not live yet — nothing to stage, applies directly exactly as before.
      const updated = await this.repo.update(productId, input, imageUrls, currentImageCount - removedCount);
      await this.invalidatePublishedListCache();
      return this.toSellerProductWithPending(updated);
    }

    const { moq, sellerPrice, priceTiers, variants, ...nonPricingFields } = input;
    const updated = await this.repo.update(productId, nonPricingFields, imageUrls, currentImageCount - removedCount);

    const proposed: ProposedPricing = {
      moq: moq ?? product.moq,
      sellerPrice: sellerPrice ?? Number(product.sellerPrice),
      priceTiers: priceTiers ?? [],
      variants: variants ?? [],
    };
    // If nothing pricing-related actually differs from what's live, skip creating a
    // pending request — the frontend always resends this data on every save, whether
    // or not the seller touched pricing.
    if (!pricingPayloadsEqual(updated, proposed)) {
      await this.repo.upsertPendingPricingChange(productId, proposed);
    }

    await this.invalidatePublishedListCache();
    return this.toSellerProductWithPending(updated);
  }

  /**
   * Admin-facing full-detail edit — unlike updateProduct, this has no seller-ownership
   * check (any existing product) and, deliberately, no "approved products are locked"
   * guard: admin already mutates approved+published products directly today (pricing,
   * category reassignment, publish/feature toggles), so allowing the same for the
   * descriptive/structural fields here is consistent with that existing trust level.
   */
  async updateProductAsAdmin(
    productId: string,
    input: UpdateProductInput,
    files: UploadedImageFile[],
    adminId: string,
  ) {
    const product = await this.getProductOrThrow(productId);

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    const imageUrls = await this.uploadImages(files, entityFolder('products', product.slug, productId));
    await this.repo.update(productId, input, imageUrls, currentImageCount - removedCount);
    await writeAuditLog(adminId, 'PRODUCT_EDITED_BY_ADMIN', 'Product', productId, {});
    await this.invalidatePublishedListCache();
    return this.getForAdmin(productId);
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
    return this.toSellerProductWithPending(withMedia as ProductWithMedia);
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

  async listPublished(filter: ProductListFilter, pagination: PaginationQuery, viewerRole?: Role) {
    // Deliberate exceptions to "always scoped": a bare `search` term (global navbar
    // search), or a curated `sort` mode (the navbar's "New Products"/"Bestsellers"/
    // "Trending" quick links) — either is enough on its own, with no category/collection
    // required.
    if (!filter.categoryId && !filter.collectionId && !filter.search && !filter.sort) {
      throw AppError.badRequest('A category, collection, search term, or sort mode is required');
    }

    // viewerRole is folded into the cache key — an AGENT viewer's response carries
    // agentPrice, a buyer/guest's doesn't, so the two must never share a cache entry.
    const key = await versionedListKey(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE, {
      ...filter,
      ...pagination,
      viewerRole: viewerRole ?? null,
    });
    const cached = await this.cache.get<{ data: BuyerProduct[]; total: number }>(key);
    if (cached) return cached;

    // "Trending" is order-volume-driven, not a plain column filter — it needs its own
    // aggregation query rather than findPublished's where-clause path.
    const { data, total } =
      filter.sort === 'trending'
        ? await this.repo.findTrending(pagination)
        : await this.repo.findPublished(
            filter,
            pagination,
            filter.categoryId ? await this.categories.getLeafDescendantIds(filter.categoryId) : undefined,
          );
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    const result = { data: data.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)), total };
    await this.cache.set(key, result, PUBLISHED_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  /** Real, distinct placeOfOrigin values among published products — for the "Made in" filter's checkbox list. */
  async listPlaceOfOriginFacets(): Promise<string[]> {
    return this.repo.findDistinctPlaceOfOrigin();
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
  async getRecommendationsForBuyer(buyerId: string, pagination: PaginationQuery, viewerRole?: Role) {
    const preferredCategoryIds = await this.getPreferredCategoryIds(buyerId);
    const { data, total } = await this.repo.findRecommended(preferredCategoryIds, pagination);
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    return { data: data.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)), total };
  }

  async getBySlug(slug: string, viewerRole?: Role): Promise<{ product: BuyerProduct; related: BuyerProduct[] }> {
    const product = await this.repo.findBySlugWithMedia(slug);
    if (!product || product.deletedAt || !product.isPublished || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.notFound('Product not found');
    }

    const related = await this.repo.findRelated(product.categoryId, product.id, 4);
    const ratings = await this.reviews.getRatingSummaries([product.id, ...related.map((p) => p.id)]);
    return {
      product: toBuyerProduct(product, ratings.get(product.id), viewerRole),
      related: related.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)),
    };
  }

  async listForSeller(
    sellerProfileId: string,
    filter: SellerProductListFilter,
    pagination: PaginationQuery,
  ) {
    const { data, total } = await this.repo.findForSeller(sellerProfileId, filter, pagination);
    const pendingRows = await this.repo.findPendingPricingChangesForProductIds(data.map((p) => p.id));
    const pendingByProductId = new Map(pendingRows.map((row) => [row.productId, row]));
    return {
      data: data.map((product) => {
        const pending = pendingByProductId.get(product.id);
        return toSellerProduct(product, pending ? toPendingPricingChange(pending) : null);
      }),
      total,
    };
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
    return this.toSellerProductWithPending(withMedia as ProductWithMedia);
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
    const pending = await this.repo.findPendingPricingChange(productId);
    return {
      ...product,
      sellerPrice: product.sellerPrice.toString(),
      adminPrice: product.adminPrice ? product.adminPrice.toString() : null,
      agentPrice: product.agentPrice ? product.agentPrice.toString() : null,
      margin: product.adminPrice
        ? calculateMargin(Number(product.adminPrice), Number(product.sellerPrice))
        : null,
      pendingPricingChange: pending ? toPendingPricingChange(pending) : null,
    };
  }

  // ─── Admin review of a seller's staged pricing/variant change ─────────────────

  async listPendingPricingChanges(pagination: PaginationQuery) {
    const { data, total } = await this.repo.findPendingPricingChanges(pagination);
    return {
      data: data.map((row) => ({
        ...toPendingPricingChange(row),
        product: row.product,
      })),
      total,
    };
  }

  private async getPendingChangeOrThrow(changeRequestId: string): Promise<ProductPricingChangeRequest> {
    const change = await this.repo.findPricingChangeById(changeRequestId);
    if (!change) throw AppError.notFound('Pricing change request not found');
    if (change.status !== 'PENDING') throw AppError.badRequest('This pricing change has already been reviewed');
    return change;
  }

  /**
   * Mirrors approveProduct's tier-pricing requirement (at least one tier must end up
   * priced) but the proposal's tiers don't have real DB ids yet — they're JSON, not
   * rows — so the admin prices them by synthetic position key instead: `flat-{i}` for
   * proposedPriceTiers[i], `variant-{vi}-tier-{ti}` for proposedVariants[vi].priceTiers[ti].
   * Reuses TierAdminPriceInput's exact shape, so no new validation schema is needed and
   * the frontend can reuse the existing TierPriceTable UI unmodified.
   */
  async approvePricingChange(
    changeRequestId: string,
    priceTierAdminPrices: TierAdminPriceInput[] = [],
    variantPriceTierAdminPrices: TierAdminPriceInput[] = [],
    adminId: string,
  ): Promise<Product> {
    const change = await this.getPendingChangeOrThrow(changeRequestId);
    const proposedPriceTiers = change.proposedPriceTiers as unknown as PriceTierInput[];
    const proposedVariants = change.proposedVariants as unknown as VariantInput[];

    const flatById = new Map(priceTierAdminPrices.map((t) => [t.id, t]));
    const variantTierById = new Map(variantPriceTierAdminPrices.map((t) => [t.id, t]));

    const priceTiers = proposedPriceTiers.map((t, i) => {
      const pricing = flatById.get(`flat-${i}`);
      return { moq: t.moq, sellerPrice: t.sellerPrice, adminPrice: pricing?.adminPrice, agentPrice: pricing?.agentPrice };
    });
    const variants = proposedVariants.map((v, vi) => ({
      ...v,
      priceTiers: (v.priceTiers ?? []).map((t, ti) => {
        const pricing = variantTierById.get(`variant-${vi}-tier-${ti}`);
        return { moq: t.moq, sellerPrice: t.sellerPrice, adminPrice: pricing?.adminPrice, agentPrice: pricing?.agentPrice };
      }),
    }));

    const cheapestOf = (field: 'adminPrice' | 'agentPrice'): number | null => {
      const prices = [
        ...priceTiers.map((t) => t[field]),
        ...variants.flatMap((v) => v.priceTiers.map((t) => t[field])),
      ].filter((p): p is number => p != null);
      return prices.length ? Math.min(...prices) : null;
    };
    const adminPrice = cheapestOf('adminPrice');
    const agentPrice = cheapestOf('agentPrice');

    if (adminPrice == null) {
      throw AppError.badRequest('Set an admin price for at least one tier to approve this pricing change');
    }

    const applyData: ApplyPricingChangeInput = {
      moq: change.proposedMoq,
      sellerPrice: Number(change.proposedSellerPrice),
      adminPrice,
      agentPrice,
      priceTiers,
      variants,
    };

    const updated = await this.repo.applyPricingChange(change.productId, change.id, applyData, adminId);
    await writeAuditLog(adminId, 'PRODUCT_PRICING_CHANGE_APPROVED', 'Product', change.productId, {});
    await this.invalidatePublishedListCache();

    const sellerUserId = await this.getSellerUserId(updated.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyPricingChangeApproved(sellerUserId, updated.name);
    }

    return updated;
  }

  async rejectPricingChange(changeRequestId: string, reason: string, adminId: string): Promise<void> {
    const change = await this.getPendingChangeOrThrow(changeRequestId);
    await this.repo.setPricingChangeRejected(change.id, { reason, reviewedById: adminId });
    await writeAuditLog(adminId, 'PRODUCT_PRICING_CHANGE_REJECTED', 'Product', change.productId, { reason });

    const product = await this.getProductOrThrow(change.productId);
    const sellerUserId = await this.getSellerUserId(product.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyPricingChangeRejected(sellerUserId, product.name, reason);
    }
  }
}

export const productsService = new ProductsService();
