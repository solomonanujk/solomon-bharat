export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  type: string;
  value: string;
}

/** Buyer-facing projection — never includes seller identity, sellerPrice, or declaredStock. */
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
  leadTime: string | null;
  certifications: string | null;
  categoryId: string;
  isFeatured: boolean;
  publishedAt: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface ProductDetailResult {
  product: BuyerProduct;
  related: BuyerProduct[];
}

export interface ProductListFilter {
  categoryId?: string;
  collectionId?: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';

export interface ProductVariantInput {
  type: string;
  value: string;
}

/** Seller-facing projection — never includes adminPrice or margin. */
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
  certifications: string | null;
  categoryId: string;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
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
  certifications?: string;
  variants?: ProductVariantInput[];
  images: File[];
}

export interface SellerProductListFilter {
  approvalStatus?: ApprovalStatus;
  page?: number;
  limit?: number;
}

export interface AdminProductListFilter {
  approvalStatus?: ApprovalStatus;
  sellerId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

/** Fields a seller may edit on their own product — PATCH /products/me/{id}. */
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
  certifications?: string;
  variants?: ProductVariantInput[];
  /** Existing image ids to remove. */
  removeImageIds?: string[];
  /** New images to add (additive — existing images not listed in removeImageIds are kept). */
  images?: File[];
}

/**
 * Response shape for the product action endpoints (approve/reject/reassignCategory/
 * publish/unpublish/feature/unfeature) — these return the raw Prisma `Product`, which
 * has NO `margin` field and is NOT the same shape as the admin list/detail row
 * (`AdminProduct`, which computes `margin` and stringifies prices explicitly). Keeping
 * this as a separate type prevents code from reading `.margin` off an action response.
 */
export interface ProductActionResult {
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
  adminPrice: string | null;
  leadTime: string | null;
  certifications: string | null;
  categoryId: string;
  sellerId: string;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin-facing projection — includes seller identity, both prices, and margin. */
export interface AdminProduct {
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
  adminPrice: string | null;
  margin: number | null;
  leadTime: string | null;
  certifications: string | null;
  categoryId: string;
  sellerId: string;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isPublished: boolean;
  createdAt: string;
  images: ProductImage[];
  seller?: { businessName: string };
  category?: { name: string };
}