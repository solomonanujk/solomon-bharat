export interface ShopifyVariant {
  id: string;
  title: string;
  price: number;
  sku: string | null;
  inventoryQuantity: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

export interface ShopifyProductOption {
  name: string;
  values: string[];
}

export interface ShopifyProductImage {
  id: string;
  src: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  bodyHtml: string;
  images: ShopifyProductImage[];
  options: ShopifyProductOption[];
  variants: ShopifyVariant[];
}

export interface ListShopifyProductsParams {
  cursor?: string;
  limit: number;
}

export interface ListShopifyProductsResult {
  products: ShopifyProduct[];
  nextCursor: string | null;
}

export interface ShopifyProvider {
  /** Throws if the domain/token combination can't reach Shopify's Admin API — the
   *  caller surfaces this as "couldn't connect, check your domain and token." */
  verifyConnection(shopDomain: string, accessToken: string): Promise<{ shopName: string }>;
  listProducts(
    shopDomain: string,
    accessToken: string,
    params: ListShopifyProductsParams,
  ): Promise<ListShopifyProductsResult>;
  getProduct(shopDomain: string, accessToken: string, shopifyProductId: string): Promise<ShopifyProduct>;
}
