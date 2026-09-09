import {
  Product,
  ProductApprovalStatus,
  ProductImage,
  ProductPriceTier,
  ProductPricingChangeStatus,
  ProductVariant,
  VariantAttribute,
  VariantPriceTier,
} from '@prisma/client';

export type VariantWithDetail = ProductVariant & {
  attributes: VariantAttribute[];
  priceTiers: VariantPriceTier[];
};

export type ProductWithMedia = Product & {
  images: ProductImage[];
  variants: VariantWithDetail[];
  priceTiers: ProductPriceTier[];
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
  attributes?: VariantAttributeInput[];
  priceTiers?: PriceTierInput[];
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
  priceTiers?: PriceTierWithAdminPricing[];
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
  variants?: VariantInput[];
  removeImageIds?: string[];
  tags?: string[];
  stepQty?: number;
  isHandmade?: boolean;
  placeOfOrigin?: string;
  isGITagged?: boolean;
  howItIsMade?: string;
  artisanName?: string;
  priceTiers?: PriceTierInput[];
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
}

export interface AdminProductListFilter {
  approvalStatus?: ProductApprovalStatus;
  sellerId?: string;
  categoryId?: string;
}

export interface SellerProductListFilter {
  approvalStatus?: ProductApprovalStatus;
}

/** A flat (non-variant) price tier stripped down to what a buyer may see — never the
 *  raw ProductPriceTier row, which also carries the seller's own cost (sellerPrice). */
export interface BuyerPriceTier {
  id: string;
  moq: number;
  adminPrice: string;
  /** Only populated when the requester is an authenticated AGENT — never sent to buyers. */
  agentPrice: string | null;
}

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
  adminPrice: string;
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
  variants: VariantWithDetail[];
  avgRating: number | null;
  reviewCount: number;
  tags: string[];
  stepQty: number;
  isHandmade: boolean;
  placeOfOrigin: string | null;
  isGITagged: boolean;
  howItIsMade: string | null;
  artisanName: string | null;
}

/** Seller-safe projection — never includes adminPrice or margin. */
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
  variants: VariantWithDetail[];
  priceTiers: ProductPriceTier[];
  tags: string[];
  stepQty: number;
  isHandmade: boolean;
  placeOfOrigin: string | null;
  isGITagged: boolean;
  howItIsMade: string | null;
  artisanName: string | null;
  /** Non-null only once this product is APPROVED and the seller has an unreviewed
   *  pricing/variant edit awaiting admin approval — see ProposedPricing above. */
  pendingPricingChange: PendingPricingChange | null;
}


export { ProductApprovalStatus, ProductPricingChangeStatus };
