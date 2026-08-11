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
}

export interface AdminProductListFilter {
  approvalStatus?: ApprovalStatus;
  sellerId?: string;
  categoryId?: string;
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