export interface ShopifyConnectionStatus {
  connected: boolean;
  shopDomain?: string;
  syncEnabled?: boolean;
  lastSyncedAt?: Date | null;
  lastSyncError?: string | null;
}

export interface ShopifyProductPreview {
  shopifyProductId: string;
  title: string;
  thumbnail: string | null;
  variantCount: number;
  minPrice: number;
  maxPrice: number;
}

export interface ListShopifyProductsInput {
  cursor?: string;
  limit: number;
}

export interface ShopifyProductListResult {
  products: ShopifyProductPreview[];
  nextCursor: string | null;
}

export interface ImportShopifyProductsInput {
  shopifyProductIds: string[];
  categoryId: string;
}

export interface ShopifyImportResult {
  imported: { shopifyProductId: string; productId: string }[];
  failed: { shopifyProductId: string; reason: string }[];
}
