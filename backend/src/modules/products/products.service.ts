import { BrandStatus, Product, ProductApprovalStatus, ProductPricingChangeRequest, Role, SellerType } from '@prisma/client';
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
  BrandFacet,
  BuyerPriceTier,
  BuyerProduct,
  BuyerProductDetail,
  CreateProductInput,
  PendingPricingChange,
  PriceTierInput,
  ProductListFilter,
  ProductWithMedia,
  ProposedPricing,
  SaveDraftInput,
  SellerProduct,
  SellerProductListFilter,
  TierAdminPriceInput,
  toBrandSummary,
  UpdateProductInput,
  UploadedImageFile,
  VariantInput,
} from './products.types';

export { toBrandSummary } from './products.types';

const MORE_FROM_BRAND_LIMIT = 8;

const MIN_IMAGES = 2;
const MAX_IMAGES = 10;
// Mirrors the multer instance-wide limit in middleware/upload.ts, which has to be
// sized for video (200MB) — this is the separate, tighter per-image cap that multer
// alone can no longer enforce now that images and videos share one multer instance.
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEOS = 3;

const OPEN_REVIEW_STATUSES: ProductApprovalStatus[] = [
  ProductApprovalStatus.PENDING,
  ProductApprovalStatus.RESUBMITTED,
];

/**
 * "No numeric wholesale price before signup" — enforced here, server-side, rather than
 * by the frontend hiding text. Guests (no role) never get a price; sellers never see
 * admin_price either (AGENTS.md "Pricing"). Buyers, agents and admins do.
 */
export function canViewWholesalePrice(viewerRole?: Role): boolean {
  return viewerRole === Role.BUYER || viewerRole === Role.AGENT || viewerRole === Role.SUPER_ADMIN;
}

/** Agents see and buy Solomon-curated products only — never marketplace brands' (owner rule). */
export function isCuratedOnlyViewer(viewerRole?: Role): boolean {
  return viewerRole === Role.AGENT;
}

interface PricedTierRow {
  id: string;
  moq: number;
  adminPrice: { toString(): string } | null;
  agentPrice: { toString(): string } | null;
}

/** Strips a raw tier row (flat or variant) down to its buyer-safe shape — never
 *  sellerPrice, agentPrice only for agents, no prices at all for guests/sellers. */
function toBuyerPriceTier(t: PricedTierRow, canSeePrice: boolean, isAgent: boolean): BuyerPriceTier {
  return {
    id: t.id,
    moq: t.moq,
    adminPrice: canSeePrice ? (t.adminPrice ? t.adminPrice.toString() : '0') : null,
    agentPrice: isAgent && t.agentPrice ? t.agentPrice.toString() : null,
  };
}

function toBuyerProduct(
  product: ProductWithMedia,
  rating?: { avgRating: number; reviewCount: number },
  viewerRole?: Role,
): BuyerProduct {
  const canSeePrice = canViewWholesalePrice(viewerRole);
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
    adminPrice: canSeePrice ? (product.adminPrice ? product.adminPrice.toString() : '0') : null,
    // Only populated for an authenticated AGENT viewer — never sent to buyers.
    agentPrice: isAgent && product.agentPrice ? product.agentPrice.toString() : null,
    priceTiers: product.priceTiers
      .filter((t) => t.adminPrice != null || t.agentPrice != null)
      .map((t) => toBuyerPriceTier(t, canSeePrice, isAgent)),
    leadTime: product.leadTime,
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    publishedAt: product.publishedAt,
    images: product.images,
    videos: product.videos,
    // Variant tiers are re-projected too — the raw VariantPriceTier rows carry the
    // seller's own cost (sellerPrice) and the agent-only agentPrice.
    variants: product.variants.map((v) => ({
      ...v,
      priceTiers: v.priceTiers.map((t) => toBuyerPriceTier(t, canSeePrice, isAgent)),
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
    craftImageUrl: product.craftImageUrl,
    ecoMaterials: product.ecoMaterials,
    ecoPackaging: product.ecoPackaging,
    ecoProduction: product.ecoProduction,
    isBestseller: product.isBestseller,
    tariffCode: product.tariffCode,
    brand: toBrandSummary(product.brand),
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
    videos: product.videos,
    variants: product.variants,
    priceTiers: product.priceTiers,
    tags: product.tags,
    stepQty: product.stepQty,
    isHandmade: product.isHandmade,
    placeOfOrigin: product.placeOfOrigin,
    isGITagged: product.isGITagged,
    howItIsMade: product.howItIsMade,
    artisanName: product.artisanName,
    craftImageUrl: product.craftImageUrl,
    ecoMaterials: product.ecoMaterials,
    ecoPackaging: product.ecoPackaging,
    ecoProduction: product.ecoProduction,
    isBestseller: product.isBestseller,
    tariffCode: product.tariffCode,
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
    weight?: number | string | { toString(): string } | null;
    weightUnit?: string | null;
    length?: number | string | { toString(): string } | null;
    width?: number | string | { toString(): string } | null;
    height?: number | string | { toString(): string } | null;
    dimensionUnit?: string | null;
    tariffCode?: string | null;
    inventory?: number | null;
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
        weight: v.weight != null ? Number(v.weight) : null,
        weightUnit: v.weightUnit ?? null,
        length: v.length != null ? Number(v.length) : null,
        width: v.width != null ? Number(v.width) : null,
        height: v.height != null ? Number(v.height) : null,
        dimensionUnit: v.dimensionUnit ?? null,
        tariffCode: v.tariffCode ?? null,
        inventory: v.inventory ?? null,
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

/** A marketplace brand's quantity-price ladder (flat or per variant) is capped at this many tiers. */
const MAX_BRAND_PRICE_TIERS = 5;

export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository = productsRepository,
    private readonly categories: CategoriesService = categoriesService,
    private readonly cache: CacheClient = defaultCache,
    private readonly reviews: ReviewsRepository = reviewsRepository,
  ) {}

  async invalidatePublishedListCache(): Promise<void> {
    await bumpVersion(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE);
  }

  /**
   * Brand id for a MARKETPLACE seller (their products take the direct-price,
   * auto-publish path); null for a CURATED seller (today's review flow, untouched).
   */
  private async resolveBrandId(sellerProfileId: string): Promise<string | null> {
    const ctx = await this.repo.findSellerContext(sellerProfileId);
    if (!ctx || ctx.sellerType !== SellerType.MARKETPLACE) return null;
    if (!ctx.brand) {
      throw AppError.forbidden('This marketplace account has no brand profile yet');
    }
    return ctx.brand.id;
  }

  /**
   * Quantity-tier rules for a marketplace brand's price ladders (the flat product ladder and
   * each variant's own ladder): at most MAX_BRAND_PRICE_TIERS tiers, quantities strictly
   * increasing, the price never rising as quantity rises (volume discount), and the first
   * tier starting at the product MOQ so every orderable quantity falls inside a tier.
   */
  private assertValidBrandTiers(input: {
    moq?: number;
    priceTiers?: { moq: number; sellerPrice: number }[];
    variants?: { value?: string; priceTiers?: { moq: number; sellerPrice: number }[] }[];
  }): void {
    const check = (tiers: { moq: number; sellerPrice: number }[] | undefined, label: string): void => {
      if (!tiers || tiers.length === 0) return;
      if (tiers.length > MAX_BRAND_PRICE_TIERS) {
        throw AppError.badRequest(`${label} can have at most ${MAX_BRAND_PRICE_TIERS} price tiers`);
      }
      if (input.moq !== undefined && input.moq >= 1 && tiers[0].moq !== input.moq) {
        throw AppError.badRequest(`${label}: the first price tier must start at the minimum order quantity (${input.moq})`);
      }
      for (let i = 1; i < tiers.length; i += 1) {
        if (tiers[i].moq <= tiers[i - 1].moq) {
          throw AppError.badRequest(`${label}: tier quantities must increase from one tier to the next`);
        }
        if (tiers[i].sellerPrice > tiers[i - 1].sellerPrice) {
          throw AppError.badRequest(`${label}: a higher quantity tier cannot cost more per unit than a lower one`);
        }
      }
    };
    check(input.priceTiers, 'Product');
    (input.variants ?? []).forEach((v) => check(v.priceTiers, v.value ? `Option "${v.value}"` : 'Option'));
  }

  /** A brand product's headline price: its cheapest tier anywhere, else the flat price it sent. */
  private brandBasePrice(input: {
    sellerPrice?: number;
    priceTiers?: { sellerPrice: number }[];
    variants?: { priceTiers?: { sellerPrice: number }[] }[];
  }): number | undefined {
    const prices = [
      ...(input.priceTiers ?? []),
      ...(input.variants ?? []).flatMap((v) => v.priceTiers ?? []),
    ].map((t) => t.sellerPrice);
    return prices.length > 0 ? Math.min(...prices) : input.sellerPrice;
  }

  /** A brand sets the buyer price itself: each tier's price is both sellerPrice (gross) and adminPrice. */
  private withBrandTierPrices<
    T extends {
      priceTiers?: { moq: number; sellerPrice: number; adminPrice?: number }[];
      variants?: { priceTiers?: { moq: number; sellerPrice: number; adminPrice?: number }[] }[];
    },
  >(input: T): T {
    const price = <R extends { sellerPrice: number }>(t: R): R & { adminPrice: number } => ({
      ...t,
      adminPrice: t.sellerPrice,
    });
    return {
      ...input,
      ...(input.priceTiers ? { priceTiers: input.priceTiers.map(price) } : {}),
      ...(input.variants
        ? { variants: input.variants.map((v) => (v.priceTiers ? { ...v, priceTiers: v.priceTiers.map(price) } : v)) }
        : {}),
    };
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
    if (files.some((f) => f.buffer.length > MAX_IMAGE_FILE_SIZE_BYTES)) {
      throw AppError.badRequest('Each image must be 5MB or smaller');
    }
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadImage(file.buffer, `${Date.now()}-${index}-${file.originalname}`, folder),
      ),
    );
    return uploads.map((u) => u.url);
  }

  private async uploadSingleImage(file: UploadedImageFile, folder: string): Promise<string> {
    if (file.buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) {
      throw AppError.badRequest('Each image must be 5MB or smaller');
    }
    const upload = await storageProvider.uploadImage(file.buffer, `${Date.now()}-craft-${file.originalname}`, folder);
    return upload.url;
  }

  /** Resolves the three ways a craft image can change on an update: a new file
   *  replaces it (url), `removeCraftImage` with no new file clears it (null), or
   *  neither applies and it's left untouched (undefined — Prisma ignores it). */
  private async resolveCraftImageUrl(
    craftImageFile: UploadedImageFile | undefined,
    removeCraftImage: boolean | undefined,
    folder: string,
  ): Promise<string | null | undefined> {
    if (craftImageFile) return this.uploadSingleImage(craftImageFile, folder);
    if (removeCraftImage) return null;
    return undefined;
  }

  private async uploadVideos(files: UploadedImageFile[], folder: string): Promise<string[]> {
    if (files.length === 0) return [];
    if (files.length > MAX_VIDEOS) {
      throw AppError.badRequest(`Products allow at most ${MAX_VIDEOS} videos`);
    }
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadVideo(file.buffer, `${Date.now()}-${index}-${file.originalname}`, folder),
      ),
    );
    return uploads.map((u) => u.url);
  }

  /**
   * When a product uses variants AND at least one variant carries a per-variant
   * `inventory` value, the shared Product.declaredStock is no longer something the
   * seller fills in directly — it's derived as the sum across variants, so admin/buyer
   * reporting still has one authoritative stock number. When variants don't use
   * per-variant inventory at all (including products with no variants), the
   * client-supplied declaredStock stays authoritative exactly as before — this guards
   * legacy variants (pre-migration) that never set `inventory` from having their
   * stock silently zeroed out.
   */
  private deriveDeclaredStock<T extends { variants?: { inventory?: number }[]; declaredStock?: number }>(
    input: T,
  ): number | undefined {
    const usesVariantInventory = input.variants?.some((v) => v.inventory != null) ?? false;
    if (!usesVariantInventory) return input.declaredStock;
    return input.variants!.reduce((sum, v) => sum + (v.inventory ?? 0), 0);
  }

  /**
   * A color-swatch image the seller picked from a photo they're uploading in this
   * same request (not one already saved to an earlier version of the product) has
   * no real URL yet at the time the form was built — the frontend sends
   * `newImageIndex` (its position in the `images` files array of this exact
   * request) instead of `imageUrl`, and this resolves it to the real, just-uploaded
   * URL now that one exists. A variant that already has a real `imageUrl` (an
   * already-saved image, picked while editing) is left untouched.
   */
  private resolveVariantImageUrls<T extends { imageUrl?: string; newImageIndex?: number }>(
    variants: T[] | undefined,
    imageUrls: string[],
  ): T[] | undefined {
    return variants?.map((v) => {
      if (v.imageUrl || v.newImageIndex == null) return v;
      const resolved = imageUrls[v.newImageIndex];
      if (!resolved) return v;
      const { newImageIndex: _newImageIndex, ...rest } = v;
      return { ...rest, imageUrl: resolved } as T;
    });
  }

  async createProduct(
    sellerProfileId: string,
    input: CreateProductInput,
    files: UploadedImageFile[],
    videoFiles: UploadedImageFile[] = [],
    craftImageFile?: UploadedImageFile,
  ): Promise<SellerProduct> {
    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    await this.categories.assertValidLeafCategory(input.categoryId);
    const brandId = await this.resolveBrandId(sellerProfileId);
    if (brandId) this.assertValidBrandTiers(input);

    const slug = await this.generateUniqueSlug(input.name);
    const id = randomUUID();
    const folder = entityFolder('products', slug, id);
    const imageUrls = await this.uploadImages(files, folder);
    const videoUrls = await this.uploadVideos(videoFiles, folder);
    const craftImageUrl = craftImageFile ? await this.uploadSingleImage(craftImageFile, folder) : undefined;
    const variants = this.resolveVariantImageUrls(input.variants, imageUrls);
    const declaredStock = this.deriveDeclaredStock({ ...input, variants }) ?? input.declaredStock;

    if (brandId) {
      // Marketplace brand: its price is the buyer price; live immediately, no admin review.
      const base = this.brandBasePrice({ ...input, variants }) ?? input.sellerPrice;
      const priced = this.withBrandTierPrices({ ...input, variants, sellerPrice: base });
      const created = await this.repo.create(
        sellerProfileId,
        { ...priced, slug, id, declaredStock, ...(craftImageUrl !== undefined ? { craftImageUrl } : {}) },
        imageUrls,
        videoUrls,
        {
          brandId,
          approvalStatus: ProductApprovalStatus.APPROVED,
          isPublished: true,
          publishedAt: new Date(),
          adminPrice: base,
        },
      );
      await this.invalidatePublishedListCache();
      return toSellerProduct(created, null);
    }

    const product = await this.repo.create(
      sellerProfileId,
      { ...input, variants, slug, id, declaredStock, ...(craftImageUrl !== undefined ? { craftImageUrl } : {}) },
      imageUrls,
      videoUrls,
    );
    await this.invalidatePublishedListCache();
    return toSellerProduct(product, null);
  }

  /**
   * Saves a minimally-valid, seller-only, invisible-everywhere-else draft the seller
   * can come back and finish later — deliberately skips the image-count check and
   * every other requirement createProduct enforces; DB-required-but-business-optional
   * columns (materials/description/moq/declaredStock/sellerPrice) get a safe
   * placeholder instead. Never touches admin review queues or public listings, since
   * DRAFT isn't in OPEN_REVIEW_STATUSES or any "published" filter.
   */
  async saveDraft(sellerProfileId: string, input: SaveDraftInput): Promise<SellerProduct> {
    await this.categories.assertValidLeafCategory(input.categoryId);
    const brandId = await this.resolveBrandId(sellerProfileId);
    if (brandId) this.assertValidBrandTiers(input);

    const slug = await this.generateUniqueSlug(input.name);
    const id = randomUUID();
    const declaredStock = this.deriveDeclaredStock(input) ?? input.declaredStock ?? 0;

    const product = await this.repo.create(
      sellerProfileId,
      {
        ...(brandId ? this.withBrandTierPrices(input) : input),
        slug,
        id,
        description: input.description ?? '',
        materials: input.materials ?? '',
        moq: input.moq ?? 0,
        declaredStock,
        sellerPrice: input.sellerPrice ?? 0,
      },
      [],
      [],
      { approvalStatus: ProductApprovalStatus.DRAFT, ...(brandId ? { brandId } : {}) },
    );
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
    videoFiles: UploadedImageFile[] = [],
    craftImageFile?: UploadedImageFile,
  ) {
    const sellerProfileId =
      sellerMode === 'existing'
        ? (await sellersService.getSellerDetailForAdmin(sellerId!)).id
        : await sellersService.getOrCreateHouseSellerProfile();

    if (sellerMode === 'existing' && (await this.resolveBrandId(sellerProfileId))) {
      throw AppError.badRequest('Marketplace brands create and price their own products');
    }

    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    await this.categories.assertValidLeafCategory(input.categoryId);

    const slug = await this.generateUniqueSlug(input.name);
    const id = randomUUID();
    const folder = entityFolder('products', slug, id);
    const imageUrls = await this.uploadImages(files, folder);
    const videoUrls = await this.uploadVideos(videoFiles, folder);
    const craftImageUrl = craftImageFile ? await this.uploadSingleImage(craftImageFile, folder) : undefined;
    const variants = this.resolveVariantImageUrls(input.variants, imageUrls);
    const declaredStock = this.deriveDeclaredStock({ ...input, variants }) ?? input.declaredStock;

    const allTiers = [
      ...(input.priceTiers ?? []),
      ...(variants ?? []).flatMap((v) => v.priceTiers ?? []),
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

    const product = await this.repo.create(
      sellerProfileId,
      { ...input, variants, slug, id, declaredStock, ...(craftImageUrl !== undefined ? { craftImageUrl } : {}) },
      imageUrls,
      videoUrls,
      {
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        adminPrice,
        agentPrice,
      },
    );

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
    rawInput: UpdateProductInput,
    files: UploadedImageFile[],
    videoFiles: UploadedImageFile[] = [],
    craftImageFile?: UploadedImageFile,
  ): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);
    const brandId = await this.resolveBrandId(sellerProfileId);
    if (brandId) this.assertValidBrandTiers(rawInput);

    // `publish` only ever matters for a DRAFT — strip it here so it never reaches the
    // repository layer (there's no such column). Every other current status ignores it.
    const { publish, ...input } = rawInput;
    const isDraft = product.approvalStatus === ProductApprovalStatus.DRAFT;
    const publishingDraft = isDraft && publish === true;

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    // A draft can be saved with any number of images (including zero) while the
    // seller is still filling it in — the full range is only enforced once they
    // actually publish it (leaving DRAFT for good).
    if (isDraft && !publishingDraft) {
      if (finalImageCount > MAX_IMAGES) {
        throw AppError.badRequest(`Products allow at most ${MAX_IMAGES} images`);
      }
    } else if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    if (publishingDraft) {
      if (!input.description?.trim()) throw AppError.badRequest('Description is required to publish this product');
      if (!input.materials?.trim()) throw AppError.badRequest('Materials are required to publish this product');
      if (!input.weight || Number(input.weight) <= 0) throw AppError.badRequest('Weight is required to publish this product');
      if (!input.moq || input.moq < 1) throw AppError.badRequest('MOQ is required to publish this product');
      if (input.declaredStock == null || input.declaredStock < 0) {
        throw AppError.badRequest('Declared stock is required to publish this product');
      }
      if (!input.sellerPrice || input.sellerPrice <= 0) throw AppError.badRequest('Seller price is required to publish this product');
    }

    const currentVideoCount = withMedia?.videos.length ?? 0;
    const removedVideoCount = input.removeVideoIds?.length ?? 0;
    const finalVideoCount = currentVideoCount - removedVideoCount + videoFiles.length;
    if (finalVideoCount > MAX_VIDEOS) {
      throw AppError.badRequest(`Products allow at most ${MAX_VIDEOS} videos`);
    }

    const folder = entityFolder('products', product.slug, productId);
    const imageUrls = await this.uploadImages(files, folder);
    const videoUrls = await this.uploadVideos(videoFiles, folder);
    const craftImageUrl = await this.resolveCraftImageUrl(craftImageFile, input.removeCraftImage, folder);
    // Resolves any variant swatch picked from a photo being uploaded in this same
    // request (sent as newImageIndex, no real URL yet) to its just-uploaded URL.
    const variants = this.resolveVariantImageUrls(input.variants, imageUrls);
    const usesVariantInventory = variants?.some((v) => v.inventory != null) ?? false;

    // A marketplace brand's edits always apply directly (even to a live product): its
    // own price IS the buyer price, so there is no admin re-pricing step to stage.
    if (product.approvalStatus !== ProductApprovalStatus.APPROVED || brandId) {
      // Not live yet — applies directly exactly as before, variants included, so
      // deriving declaredStock from them here is safe (nothing is staged in this branch).
      const declaredStock = usesVariantInventory
        ? variants!.reduce((sum, v) => sum + (v.inventory ?? 0), 0)
        : input.declaredStock;
      // A brand's headline price is its cheapest tier (equal to the flat price when it has none).
      const brandBase = brandId ? this.brandBasePrice({ ...input, variants }) : undefined;
      const baseInput = brandId
        ? this.withBrandTierPrices({ ...input, variants, ...(brandBase !== undefined ? { sellerPrice: brandBase } : {}) })
        : { ...input, variants };
      const draftTransition = brandId
        ? {
            approvalStatus: ProductApprovalStatus.APPROVED,
            isPublished: true,
            publishedAt: new Date(),
            ...(brandBase !== undefined ? { adminPrice: brandBase } : {}),
          }
        : { approvalStatus: ProductApprovalStatus.PENDING };
      const finalInput = {
        ...baseInput,
        ...(declaredStock !== undefined ? { declaredStock } : {}),
        ...(publishingDraft ? draftTransition : {}),
        // A live brand product being re-priced: keep the buyer price in step with it.
        ...(brandId && !publishingDraft && brandBase !== undefined ? { adminPrice: brandBase } : {}),
        ...(craftImageUrl !== undefined ? { craftImageUrl } : {}),
      };
      const updated = await this.repo.update(
        productId,
        finalInput,
        imageUrls,
        currentImageCount - removedCount,
        videoUrls,
        currentVideoCount - removedVideoCount,
      );
      await this.invalidatePublishedListCache();
      return this.toSellerProductWithPending(updated);
    }

    // Approved (live) product: variants are staged, not applied — so a declaredStock
    // derived from *proposed* variant inventory must wait until the pending change is
    // actually approved (see approvePricingChange), not be applied to the live product
    // now. When inventory isn't variant-driven, declaredStock still applies immediately
    // exactly as before (it was never part of the staged pricing bundle).
    const { moq, sellerPrice, priceTiers, variants: _rawVariants, declaredStock, ...restFields } = input;
    const nonPricingFields =
      usesVariantInventory || declaredStock === undefined ? restFields : { ...restFields, declaredStock };
    const finalNonPricingFields =
      craftImageUrl !== undefined ? { ...nonPricingFields, craftImageUrl } : nonPricingFields;
    const updated = await this.repo.update(
      productId,
      finalNonPricingFields,
      imageUrls,
      currentImageCount - removedCount,
      videoUrls,
      currentVideoCount - removedVideoCount,
    );

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
    videoFiles: UploadedImageFile[] = [],
    craftImageFile?: UploadedImageFile,
  ) {
    const product = await this.getProductOrThrow(productId);

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    const currentVideoCount = withMedia?.videos.length ?? 0;
    const removedVideoCount = input.removeVideoIds?.length ?? 0;
    const finalVideoCount = currentVideoCount - removedVideoCount + videoFiles.length;
    if (finalVideoCount > MAX_VIDEOS) {
      throw AppError.badRequest(`Products allow at most ${MAX_VIDEOS} videos`);
    }

    const folder = entityFolder('products', product.slug, productId);
    const imageUrls = await this.uploadImages(files, folder);
    const videoUrls = await this.uploadVideos(videoFiles, folder);
    const craftImageUrl = await this.resolveCraftImageUrl(craftImageFile, input.removeCraftImage, folder);
    // Admin edits always apply directly (no staging), so deriving from variant
    // inventory here is safe exactly like the not-yet-approved seller path.
    const declaredStock = this.deriveDeclaredStock(input);
    const finalInput = {
      ...input,
      ...(declaredStock !== undefined ? { declaredStock } : {}),
      ...(craftImageUrl !== undefined ? { craftImageUrl } : {}),
    };
    await this.repo.update(
      productId,
      finalInput,
      imageUrls,
      currentImageCount - removedCount,
      videoUrls,
      currentVideoCount - removedVideoCount,
    );
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
    if (product.brandId) {
      throw AppError.badRequest('A marketplace brand sets the price of its own products');
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

  /**
   * A marketplace brand takes its own product off (or back on) the marketplace. Route is
   * gated by requireMarketplaceSeller; this also refuses non-brand products so a curated
   * product can never be published without admin pricing.
   */
  async setPublishedBySeller(sellerProfileId: string, productId: string, isPublished: boolean): Promise<Product> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);
    if (!product.brandId) {
      throw AppError.forbidden('Only marketplace brand products can be published or unpublished by the seller');
    }
    return this.setPublished(product.id, isPublished);
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
    // A brand slug is also a valid scope (brand storefront / "Buy more from this brand").
    if (!filter.categoryId && !filter.collectionId && !filter.search && !filter.sort && !filter.brand) {
      throw AppError.badRequest('A category, collection, search term, or sort mode is required');
    }

    // A price-range filter against a guest's request would let them binary-search the
    // hidden wholesale price, so it's refused outright rather than silently ignored.
    if (!canViewWholesalePrice(viewerRole) && (filter.minPrice !== undefined || filter.maxPrice !== undefined)) {
      throw AppError.badRequest('Sign in as a buyer to filter by price');
    }

    if (filter.curated && filter.brand) {
      throw AppError.badRequest('Choose either curated or a brand');
    }

    // Agents never see marketplace brands: a brand filter yields nothing (not an error),
    // and everything else is restricted to curated products (brandId = null).
    const curatedOnly = isCuratedOnlyViewer(viewerRole);
    if (curatedOnly && filter.brand) {
      return { data: [], total: 0 };
    }
    if (curatedOnly) {
      filter = { ...filter, curated: true };
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
        ? await this.repo.findTrending(pagination, !!filter.curated)
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
  async listPlaceOfOriginFacets(viewerRole?: Role): Promise<string[]> {
    return this.repo.findDistinctPlaceOfOrigin(isCuratedOnlyViewer(viewerRole));
  }

  /** Active brands with published products + counts — powers the brand filter. */
  async listBrandFacets(viewerRole?: Role): Promise<BrandFacet[]> {
    if (isCuratedOnlyViewer(viewerRole)) return [];
    return this.repo.findBrandFacets();
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
    const { data, total } = await this.repo.findRecommended(
      preferredCategoryIds,
      pagination,
      isCuratedOnlyViewer(viewerRole),
    );
    const ratings = await this.reviews.getRatingSummaries(data.map((p) => p.id));
    return { data: data.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)), total };
  }

  async getBySlug(slug: string, viewerRole?: Role): Promise<BuyerProductDetail> {
    const product = await this.repo.findBySlugWithMedia(slug);
    if (!product || product.deletedAt || !product.isPublished || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.notFound('Product not found');
    }
    // A suspended brand's products are invisible, including by direct link.
    if (product.brand?.status === BrandStatus.SUSPENDED) {
      throw AppError.notFound('Product not found');
    }
    // A brand product is invisible to agents, including by direct link.
    if (product.brandId && isCuratedOnlyViewer(viewerRole)) {
      throw AppError.notFound('Product not found');
    }

    const related = await this.repo.findRelated(product.categoryId, product.id, 4, isCuratedOnlyViewer(viewerRole));
    const moreFromBrand = product.brandId
      ? await this.repo.findMoreFromBrand(product.brandId, product.id, MORE_FROM_BRAND_LIMIT)
      : [];
    const ratings = await this.reviews.getRatingSummaries([
      product.id,
      ...related.map((p) => p.id),
      ...moreFromBrand.map((p) => p.id),
    ]);
    return {
      product: toBuyerProduct(product, ratings.get(product.id), viewerRole),
      related: related.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)),
      moreFromBrand: moreFromBrand.map((p) => toBuyerProduct(p, ratings.get(p.id), viewerRole)),
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

    // Mirrors ProductsService.deriveDeclaredStock — the same variant-inventory-derived
    // stock the seller's proposal implied, applied now that the variants themselves
    // are actually going live (see the note in updateProduct about why this can't be
    // applied any earlier).
    const usesVariantInventory = proposedVariants.some((v) => v.inventory != null);
    const declaredStock = usesVariantInventory
      ? variants.reduce((sum, v) => sum + (v.inventory ?? 0), 0)
      : undefined;

    const applyData: ApplyPricingChangeInput = {
      moq: change.proposedMoq,
      sellerPrice: Number(change.proposedSellerPrice),
      adminPrice,
      agentPrice,
      declaredStock,
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

/** Clears the published-product list cache - for other modules (brands) that change what buyers see. */
export function invalidatePublishedListCache(): Promise<void> {
  return productsService.invalidatePublishedListCache();
}
