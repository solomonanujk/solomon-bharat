import { logger } from '../../config/logger';
import {
  ListShopifyProductsParams,
  ListShopifyProductsResult,
  ShopifyProduct,
  ShopifyProvider,
} from './shopifyProvider.types';

const API_VERSION = '2024-10';
const PRODUCT_FIELDS = 'id,title,body_html,images,options,variants';

// Raw shapes as Shopify's REST Admin API actually returns them — only the
// fields this platform uses are typed, everything else is ignored.
interface RawShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string | null;
  inventory_quantity: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}
interface RawShopifyProductOption {
  name: string;
  values: string[];
}
interface RawShopifyProductImage {
  id: number;
  src: string;
}
interface RawShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  images: RawShopifyProductImage[];
  options: RawShopifyProductOption[];
  variants: RawShopifyVariant[];
}

function normalizeProduct(raw: RawShopifyProduct): ShopifyProduct {
  return {
    id: String(raw.id),
    title: raw.title,
    bodyHtml: raw.body_html ?? '',
    images: (raw.images ?? []).map((img) => ({ id: String(img.id), src: img.src })),
    options: (raw.options ?? []).map((o) => ({ name: o.name, values: o.values })),
    variants: (raw.variants ?? []).map((v) => ({
      id: String(v.id),
      title: v.title,
      price: Number(v.price),
      sku: v.sku,
      inventoryQuantity: v.inventory_quantity ?? 0,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
    })),
  };
}

/** Pulls the `page_info` cursor out of the `rel="next"` entry of Shopify's
 *  `Link` response header — Shopify's REST Admin API is cursor-paginated
 *  only, there is no page-number scheme. */
function parseNextCursor(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const next = linkHeader.split(',').find((part) => part.includes('rel="next"'));
  if (!next) return null;
  const match = next.match(/<([^>]+)>/);
  if (!match) return null;
  try {
    return new URL(match[1]).searchParams.get('page_info');
  } catch {
    return null;
  }
}

export class ShopifyApiProvider implements ShopifyProvider {
  private baseUrl(shopDomain: string): string {
    return `https://${shopDomain}/admin/api/${API_VERSION}`;
  }

  private headers(accessToken: string): Record<string, string> {
    return { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  }

  async verifyConnection(shopDomain: string, accessToken: string): Promise<{ shopName: string }> {
    const res = await fetch(`${this.baseUrl(shopDomain)}/shop.json`, { headers: this.headers(accessToken) });
    if (!res.ok) {
      logger.warn({ shopDomain, status: res.status }, 'Shopify: connection verification failed');
      throw new Error(`Shopify responded ${res.status}`);
    }
    const data = (await res.json()) as { shop: { name: string } };
    return { shopName: data.shop.name };
  }

  async listProducts(
    shopDomain: string,
    accessToken: string,
    { cursor, limit }: ListShopifyProductsParams,
  ): Promise<ListShopifyProductsResult> {
    const params = new URLSearchParams({ limit: String(limit), fields: PRODUCT_FIELDS });
    if (cursor) params.set('page_info', cursor);

    const res = await fetch(`${this.baseUrl(shopDomain)}/products.json?${params.toString()}`, {
      headers: this.headers(accessToken),
    });
    if (!res.ok) {
      logger.warn({ shopDomain, status: res.status }, 'Shopify: product list fetch failed');
      throw new Error(`Shopify responded ${res.status}`);
    }
    const data = (await res.json()) as { products: RawShopifyProduct[] };
    return {
      products: data.products.map(normalizeProduct),
      nextCursor: parseNextCursor(res.headers.get('link')),
    };
  }

  async getProduct(shopDomain: string, accessToken: string, shopifyProductId: string): Promise<ShopifyProduct> {
    const params = new URLSearchParams({ fields: PRODUCT_FIELDS });
    const res = await fetch(`${this.baseUrl(shopDomain)}/products/${shopifyProductId}.json?${params.toString()}`, {
      headers: this.headers(accessToken),
    });
    if (!res.ok) {
      logger.warn({ shopDomain, shopifyProductId, status: res.status }, 'Shopify: product fetch failed');
      throw new Error(`Shopify responded ${res.status}`);
    }
    const data = (await res.json()) as { product: RawShopifyProduct };
    return normalizeProduct(data.product);
  }
}
