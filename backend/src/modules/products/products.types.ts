import {
  BrandStatus,
  Prisma,
  Product,
  ProductApprovalStatus,
  ProductImage,
  ProductPriceTier,
  ProductPricingChangeStatus,
  ProductVariant,
  ProductVideo,
  VariantAttribute,
  VariantPriceTier,
} from '@prisma/client';

/**
 * The ONLY Brand columns ever selected on public/product queries — a whitelist, so
 * private data (legalName, gstin, commission overrides, seller linkage) can never
 * reach a buyer payload through a product include. `status` is selected so queries
 * can exclude suspended brands, but it is not part of the serialised BrandSummary.
 */
export const BRAND_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  isVerified: true,
  status: true,
  minOrderValueInr: true,
} satisfies Prisma.BrandSelect;

/** Row shape produced by selecting BRAND_SUMMARY_SELECT. */
export interface BrandSummarySource {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
  status: BrandStatus;
  minOrderValueInr: { toString(): string } | number | string;
}

/** Public brand tag attached to buyer-facing product / wishlist / order-item payloads. */
export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
  minOrderValueInr: number;
}

/** Whitelist serializer — null for curated products (no brand). Exported for other modules (wishlist, orders). */
export function toBrandSummary(brand: BrandSummarySource | null | undefined): BrandSummary | null {
  if (!brand) return null;
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    isVerified: brand.isVerified,
    minOrderValueInr: Number(brand.minOrderValueInr.toString()),
  };
}

export type VariantWithDetail = ProductVariant & {
  attributes: VariantAttribute[];
  priceTiers: VariantPriceTier[];
};

export type ProductWithMedia = Product & {
  images: ProductImage[];
  videos: ProductVideo[];
  variants: VariantWithDetail[];
  priceTiers: ProductPriceTier[];
  /** Whitelisted brand row (BRAND_SUMMARY_SELECT) — null/absent for curated products. */
  brand?: BrandSummarySource | null;
};

export interface PriceTierInput {
  moq: number;
  sellerPrice: number;
}

/**
 * Admin sets a price on an existing seller tier — identified by that tier's id.
 * adminPrice/agentPrice are independent: a given update may carry either, or both.
 */
export interface TierAdminPriceInput {
  id: string;
  adminPrice?: number;
  agentPrice?: number;
}

export interface VariantAttributeInput {
  name: string;
  value: string;
}

export interface VariantInput {
  type: string;
  value: string;
  sku?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  imageUrl?: string;
  // A swatch image picked from a photo being uploaded in this same request (not
  // one already saved) has no real URL yet — this is its index into the `images`
  // files array of this request instead; ProductsService.resolveVariantImageUrls
  // turns it into a real imageUrl once the upload completes.
  newImageIndex?: number;
  attributes?: VariantAttributeInput[];
  priceTiers?: PriceTierInput[];
  // Faire-parity per-variant shipping/inventory detail (PRD §8.5/§8.9, §15.3).
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: 'cm' | 'in';
  tariffCode?: string;
  inventory?: number;
}

// ─── Staged pricing/variant changes on an already-approved (live) product ───────
// See ProductsService.updateProduct: once a product is APPROVED, moq/sellerPrice/
// priceTiers/variants no longer apply directly — they're staged here until an admin
// approves them, so buyers keep seeing the last-approved pricing/variants untouched.

/** What the seller proposed — mirrors the pricing-relevant slice of UpdateProductInput. */
export interface ProposedPricing {
  moq: number;
  sellerPrice: number;
  priceTiers: PriceTierInput[];
  variants: VariantInput[];
}

export interface PriceTierWithAdminPricing extends PriceTierInput {
  adminPrice?: number;
  agentPrice?: number;
}

export interface VariantInputWithAdminPricing extends Omit<VariantInput, 'priceTiers'> {
  priceTiers?: PriceTierWithAdminPricing[];
}

/** Fully-resolved data the repository persists atomically when an admin approves a
 *  pending change — adminPrice/agentPrice are already merged into each tier by then. */
export interface ApplyPricingChangeInput {
  moq: number;
  sellerPrice: number;
  adminPrice: number | null;
  agentPrice: number | null;
  /** Set only when the approved variants use per-variant inventory — see
   *  ProductsService.deriveDeclaredStock / approvePricingChange. */
  declaredStock?: number;
  priceTiers: PriceTierWithAdminPricing[];
  variants: VariantInputWithAdminPricing[];
}

/** Buyer-invisible summary attached to the seller/admin product projections. */
export interface PendingPricingChange {
  id: string;
  proposedMoq: number;
  proposedSellerPrice: string;
  proposedPriceTiers: PriceTierInput[];
  proposedVariants: VariantInput[];
  createdAt: Date;
}

export interface CreateProductInput {
  name: string;
  description: string;
  categoryId: string;
  materials: string;
  dimensions?: string;
  weight?: string;
  moq: number;
  declaredStock: number;
  sellerPrice: number;
  leadTime?: string;
  // Widened to the WithAdminPricing variants (a strict superset of
  // VariantInput/PriceTierInput) so the same type serves both the plain seller-create
  // path (adminPrice/agentPrice simply absent) and admin-create, where they're set
  // directly per tier — see ProductsService.createProductAsAdmin.
  variants?: VariantInputWithAdminPricing[];
  tags?: string[];
  stepQty?: number;
  isHandmade?: boolean;
  placeOfOrigin?: string;
  isGITagged?: boolean;
  howItIsMade?: string;
  artisanName?: string;
  // Resolved by the service from the uploaded craftImage file, never sent directly by
  // the client — see ProductsService.createProduct/createProductAsAdmin.
  craftImageUrl?: string | null;
  priceTiers?: PriceTierWithAdminPricing[];
  // Faire-parity fields (PRD §8.5/§8.9, §15.3).
  ecoMaterials?: string[];
  ecoPackaging?: string[];
  ecoProduction?: string[];
  isBestseller?: boolean;
  tariffCode?: string;
}

/** Only name + categoryId are real requirements — see ProductsService.saveDraft for
 *  the placeholders used for every other CreateProductInput field a draft omits. */
export interface SaveDraftInput {
  name: string;
  categoryId: string;
  description?: string;
  materials?: string;
  dimensions?: string;
  weight?: string;
  moq?: number;
  declaredStock?: number;
  sellerPrice?: number;
  leadTime?: string;
  variants?: VariantInputWithAdminPricing[];
  tags?: string[];
  stepQty?: number;
  isHandmade?: boolean;
  placeOfOrigin?: string;
  isGITagged?: boolean;
  howItIsMade?: string;
  artisanName?: string;
  priceTiers?: PriceTierWithAdminPricing[];
  ecoMaterials?: string[];
  ecoPackaging?: string[];
  ecoProduction?: string[];
  isBestseller?: boolean;
  tariffCode?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  materials?: string;
  dimensions?: string;
  weight?: string;
  moq?: number;
  declaredStock?: number;
  sellerPrice?: number;
  leadTime?: string;
  variants?: VariantInputWithAdminPricing[];
  // Only meaningful when the product being updated is currently DRAFT — see
  // ProductsService.updateProduct. Never forwarded to the repository layer.
  publish?: boolean;
  // Set internally by the service (never by the controller/DTO) when a draft update
  // transitions the product to PENDING.
  approvalStatus?: ProductApprovalStatus;
  // Set internally by the service (never by the controller/DTO) on the marketplace
  // brand path, where the brand's own price IS the buyer price and the product
  // publishes without admin review.
  adminPrice?: number;
  isPublished?: boolean;
  publishedAt?: Date;
  removeImageIds?: string[];
  removeVideoIds?: string[];
  // Client-sent flag meaning "clear the craft image" — never forwarded to the
  // repository layer. The service converts it (and/or an uploaded replacement file)
  // into a real craftImageUrl value before calling repo.update — see
  // ProductsService.updateProduct/updateProductAsAdmin.
  removeCraftImage?: boolean;
  // Resolved by the service from the uploaded craftImage file (or null when
  // removeCraftImage is set with no replacement) — never sent directly by the client.
  craftImageUrl?: string | null;
  tags?: string[];
  stepQty?: number;
  isHandmade?: boolean;
  placeOfOrigin?: string;
  isGITagged?: boolean;
  howItIsMade?: string;
  artisanName?: string;
  priceTiers?: PriceTierWithAdminPricing[];
  ecoMaterials?: string[];
  ecoPackaging?: string[];
  ecoProduction?: string[];
  isBestseller?: boolean;
  tariffCode?: string;
}

export interface UploadedImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ProductListFilter {
  categoryId?: string;
  collectionId?: string;
  search?: string;
  /** Curated unscoped browse modes for the homepage/navbar quick links — see AGENTS.md "Search". */
  sort?: 'newest' | 'featured' | 'trending';
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  moqMax?: number;
  /** Free-text contains-match against the product's place of origin — the closest
   *  real field this platform has to a "ships from" concept. */
  placeOfOrigin?: string;
  /** Free-text contains-match against the product's lead time (e.g. "1-2 weeks"). */
  leadTime?: string;
  /** Brand slug — a valid scope on its own (brand storefront, "Buy more from this brand"). */
  brand?: string;
  /** true = only Solomon-curated products (brandId null). NOT a scope on its own. */
  curated?: boolean;
}

/** One entry of GET /products/facets/brands. */
export interface BrandFacet {
  slug: string;
  name: string;
  count: number;
}

export interface AdminProductListFilter {
  approvalStatus?: ProductApprovalStatus;
  sellerId?: string;
  categoryId?: string;
}

export interface SellerProductListFilter {
  approvalStatus?: ProductApprovalStatus;
}

/** A price tier (flat or per-variant) stripped down to what a buyer may see — never the
 *  raw ProductPriceTier/VariantPriceTier row, which also carries the seller's own cost
 *  (sellerPrice). */
export interface BuyerPriceTier {
  id: string;
  moq: number;
  /** null for viewers not entitled to wholesale pricing (guests, sellers) — see
   *  canViewWholesalePrice in products.service.ts. */
  adminPrice: string | null;
  /** Only populated when the requester is an authenticated AGENT — never sent to buyers. */
  agentPrice: string | null;
}

/** Buyer-safe variant — the raw ProductVariant minus its raw price tiers. */
export type BuyerVariant = ProductVariant & {
  attributes: VariantAttribute[];
  priceTiers: BuyerPriceTier[];
};

/** Buyer-safe projection — never includes sellerId, sellerPrice, or declaredStock. */
export interface BuyerProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  materials: string;
  dimensions: string | null;
  weight: string | null;
  moq: number;
  /** null for guests (and sellers) — no numeric wholesale price before signup. */
  adminPrice: string | null;
  /** Only populated when the requester is an authenticated AGENT — never sent to buyers. */
  agentPrice: string | null;
  /** Only the product's own flat tiers — empty when this product uses variants
   *  instead (each variant carries its own priceTiers on `variants` below). */
  priceTiers: BuyerPriceTier[];
  leadTime: string | null;
  categoryId: string;
  isFeatured: boolean;
  publishedAt: Date | null;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: BuyerVariant[];
  avgRating: number | null;
  reviewCount: number;
  tags: string[];
  stepQty: number;
  isHandmade: boolean;
  placeOfOrigin: string | null;
  isGITagged: boolean;
  howItIsMade: string | null;
  artisanName: string | null;
  craftImageUrl: string | null;
  ecoMaterials: string[];
  ecoPackaging: string[];
  ecoProduction: string[];
  isBestseller: boolean;
  tariffCode: string | null;
  /** Marketplace brand tag; null for Solomon-curated products (no seller identity). */
  brand: BrandSummary | null;
}

/** GET /products/:slug payload. */
export interface BuyerProductDetail {
  product: BuyerProduct;
  related: BuyerProduct[];
  /** Up to 8 other published products of the same brand; empty for curated products. */
  moreFromBrand: BuyerProduct[];
}

/** Seller-safe projection — never includes adminPrice or margin. */
/** A tier row as a seller may see it: never agentPrice; adminPrice only for marketplace
 *  brands (it is their own buyer price) and omitted entirely for curated sellers. */
export type SellerPriceTier<T extends { adminPrice: unknown; agentPrice: unknown }> =
  Omit<T, 'adminPrice' | 'agentPrice'> & { adminPrice?: T['adminPrice'] };

export type SellerVariant = Omit<VariantWithDetail, 'priceTiers'> & {
  priceTiers: SellerPriceTier<VariantPriceTier>[];
};

export interface SellerProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  materials: string;
  dimensions: string | null;
  weight: string | null;
  moq: number;
  declaredStock: number;
  sellerPrice: string;
  leadTime: string | null;
  categoryId: string;
  approvalStatus: ProductApprovalStatus;
  rejectionReason: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: SellerVariant[];
  priceTiers: SellerPriceTier<ProductPriceTier>[];
  tags: string[];
  stepQty: number;
  isHandmade: boolean;
  placeOfOrigin: string | null;
  isGITagged: boolean;
  howItIsMade: string | null;
  artisanName: string | null;
  craftImageUrl: string | null;
  ecoMaterials: string[];
  ecoPackaging: string[];
  ecoProduction: string[];
  isBestseller: boolean;
  tariffCode: string | null;
  /** Non-null only once this product is APPROVED and the seller has an unreviewed
   *  pricing/variant edit awaiting admin approval — see ProposedPricing above. */
  pendingPricingChange: PendingPricingChange | null;
}


export { ProductApprovalStatus, ProductPricingChangeStatus };
