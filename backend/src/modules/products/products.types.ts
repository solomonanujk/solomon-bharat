import {
  Product,
  ProductApprovalStatus,
  ProductImage,
  ProductPriceTier,
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

export interface VariantAttributeInput {
  name: string;
  value: string;
}

export interface VariantInput {
  type: string;
  value: string;
  sku?: string;
  sellerPrice?: number;
  moq?: number;
  stock?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  imageUrl?: string;
  attributes?: VariantAttributeInput[];
  priceTiers?: PriceTierInput[];
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
  tags?: string[];
  stepQty?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  isHandmade?: boolean;
  placeOfOrigin?: string;
  isGITagged?: boolean;
  howItIsMade?: string;
  artisanName?: string;
  priceTiers?: PriceTierInput[];
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
  tags?: string[];
  stepQty?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
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
  variants: VariantWithDetail[];
  avgRating: number | null;
  reviewCount: number;
  tags: string[];
  stepQty: number;
  lengthCm: number | null;
  breadthCm: number | null;
  heightCm: number | null;
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
  certifications: string | null;
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
  lengthCm: number | null;
  breadthCm: number | null;
  heightCm: number | null;
  isHandmade: boolean;
  placeOfOrigin: string | null;
  isGITagged: boolean;
  howItIsMade: string | null;
  artisanName: string | null;
}

export { ProductApprovalStatus };
