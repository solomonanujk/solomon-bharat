import { Product, ProductApprovalStatus, ProductImage, ProductVariant } from '@prisma/client';

export type ProductWithMedia = Product & { images: ProductImage[]; variants: ProductVariant[] };

export interface VariantInput {
  type: string;
  value: string;
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
  variants?: VariantInput[];
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
  certifications?: string;
  variants?: VariantInput[];
  removeImageIds?: string[];
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
  leadTime: string | null;
  certifications: string | null;
  categoryId: string;
  isFeatured: boolean;
  publishedAt: Date | null;
  images: ProductImage[];
  variants: ProductVariant[];
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
  certifications: string | null;
  categoryId: string;
  approvalStatus: ProductApprovalStatus;
  rejectionReason: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: ProductImage[];
  variants: ProductVariant[];
}

export { ProductApprovalStatus };
