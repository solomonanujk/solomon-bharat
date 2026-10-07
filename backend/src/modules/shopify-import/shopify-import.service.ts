import { randomUUID } from 'crypto';
import { ProductApprovalStatus, ShopifyConnection } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { logger } from '../../config/logger';
import { slugify, uniqueSlugSuffix, entityFolder } from '../../utils/helpers';
import { encryptSecret, decryptSecret } from '../../utils/crypto';
import { storageProvider } from '../../providers/storage';
import { shopifyProvider, ShopifyProduct } from '../../providers/shopify';
import { categoriesService, CategoriesService } from '../categories/categories.service';
import { ProductsRepository, productsRepository } from '../products/products.repository';
import { CreateProductInput, ProposedPricing, VariantInputWithAdminPricing } from '../products/products.types';
import { shopifySyncQueue, SYNC_CONNECTION_JOB } from '../../queues/shopifySync.queue';
import { ShopifyImportRepository, shopifyImportRepository, SyncableProduct } from './shopify-import.repository';
import {
  ImportShopifyProductsInput,
  ListShopifyProductsInput,
  ShopifyConnectionStatus,
  ShopifyImportResult,
  ShopifyProductListResult,
  ShopifyProductPreview,
} from './shopify-import.types';

// Mirrors products.service.ts's own per-image cap (not exported from there).
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Fetches an image URL into a Buffer. Returns null (never throws) on any
 *  failure — one bad product photo must never abort the whole import/sync. */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ url, status: res.status }, 'Shopify import: image fetch failed, skipping');
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) {
      logger.warn({ url }, 'Shopify import: image too large, skipping');
      return null;
    }
    return buffer;
  } catch (err) {
    logger.warn({ err, url }, 'Shopify import: image fetch threw, skipping');
    return null;
  }
}

function previewFromShopifyProduct(p: ShopifyProduct): ShopifyProductPreview {
  const prices = p.variants.map((v) => v.price);
  return {
    shopifyProductId: p.id,
    title: p.title,
    thumbnail: p.images[0]?.src ?? null,
    variantCount: p.variants.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

/** Shopify descriptions are HTML; this platform's description field is plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class ShopifyImportService {
  constructor(
    private readonly repo: ShopifyImportRepository = shopifyImportRepository,
    private readonly productsRepo: ProductsRepository = productsRepository,
    private readonly categories: CategoriesService = categoriesService,
  ) {}

  private async getConnectionOrThrow(sellerProfileId: string): Promise<ShopifyConnection> {
    const connection = await this.repo.findConnectionBySellerId(sellerProfileId);
    if (!connection) {
      throw AppError.notFound('No Shopify store connected');
    }
    return connection;
  }

  private toStatus(connection: ShopifyConnection): ShopifyConnectionStatus {
    return {
      connected: true,
      shopDomain: connection.shopDomain,
      syncEnabled: connection.syncEnabled,
      lastSyncedAt: connection.lastSyncedAt,
      lastSyncError: connection.lastSyncError,
    };
  }

  async connect(
    sellerProfileId: string,
    input: { shopDomain: string; accessToken: string },
  ): Promise<ShopifyConnectionStatus> {
    try {
      await shopifyProvider.verifyConnection(input.shopDomain, input.accessToken);
    } catch (err) {
      logger.warn({ err, shopDomain: input.shopDomain }, 'Shopify: connect verification failed');
      throw AppError.badRequest('Could not connect — check your shop domain and access token.');
    }

    const connection = await this.repo.upsertConnection(sellerProfileId, {
      shopDomain: input.shopDomain,
      accessTokenCiphertext: encryptSecret(input.accessToken),
    });
    return this.toStatus(connection);
  }

  async getConnectionStatus(sellerProfileId: string): Promise<ShopifyConnectionStatus> {
    const connection = await this.repo.findConnectionBySellerId(sellerProfileId);
    if (!connection) return { connected: false };
    return this.toStatus(connection);
  }

  async disconnect(sellerProfileId: string): Promise<void> {
    await this.getConnectionOrThrow(sellerProfileId);
    await this.repo.deleteConnection(sellerProfileId);
  }

  async setSyncEnabled(sellerProfileId: string, syncEnabled: boolean): Promise<ShopifyConnectionStatus> {
    const connection = await this.getConnectionOrThrow(sellerProfileId);
    const updated = await this.repo.updateConnection(connection.id, { syncEnabled });
    return this.toStatus(updated);
  }

  /** Enqueues one immediate sync job for this seller's connection — the same
   *  job the recurring dispatcher enqueues, just triggered on demand. */
  async triggerSync(sellerProfileId: string): Promise<void> {
    const connection = await this.getConnectionOrThrow(sellerProfileId);
    await shopifySyncQueue.add(SYNC_CONNECTION_JOB, { connectionId: connection.id });
  }

  async listShopifyProducts(
    sellerProfileId: string,
    params: ListShopifyProductsInput,
  ): Promise<ShopifyProductListResult> {
    const connection = await this.getConnectionOrThrow(sellerProfileId);
    const accessToken = decryptSecret(connection.accessTokenCiphertext);
    const { products, nextCursor } = await shopifyProvider.listProducts(connection.shopDomain, accessToken, params);
    return { products: products.map(previewFromShopifyProduct), nextCursor };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    // eslint-disable-next-line no-await-in-loop
    while (await this.productsRepo.slugExists(slug)) {
      slug = `${base}-${uniqueSlugSuffix()}`;
    }
    return slug;
  }

  /** A Shopify product with only one (the implicit default) variant isn't a
   *  "real" variant on this platform — only products with 2+ variants map to
   *  this platform's variant model. */
  private mapVariants(product: ShopifyProduct): VariantInputWithAdminPricing[] | undefined {
    if (product.variants.length <= 1) return undefined;
    const optionNames = product.options.map((o) => o.name);
    return product.variants.map((v) => {
      const values = [v.option1, v.option2, v.option3].filter((x): x is string => x !== null);
      const attributes = optionNames
        .map((name, i) => ({ name, value: values[i] }))
        .filter((a): a is { name: string; value: string } => !!a.value);
      const primary = attributes[0] ?? { name: 'Option', value: v.title };
      return {
        type: primary.name,
        value: primary.value,
        sku: v.sku ?? undefined,
        attributes: attributes.length ? attributes : undefined,
        priceTiers: [{ moq: 1, sellerPrice: v.price }],
        inventory: v.inventoryQuantity,
        shopifyVariantId: v.id,
      };
    });
  }

  async importProducts(sellerProfileId: string, input: ImportShopifyProductsInput): Promise<ShopifyImportResult> {
    const connection = await this.getConnectionOrThrow(sellerProfileId);
    await this.categories.assertValidLeafCategory(input.categoryId);
    const accessToken = decryptSecret(connection.accessTokenCiphertext);

    const result: ShopifyImportResult = { imported: [], failed: [] };

    for (const shopifyProductId of input.shopifyProductIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const product = await shopifyProvider.getProduct(connection.shopDomain, accessToken, shopifyProductId);

        // eslint-disable-next-line no-await-in-loop
        const slug = await this.generateUniqueSlug(product.title);
        const id = randomUUID();
        const folder = entityFolder('products', slug, id);

        // eslint-disable-next-line no-await-in-loop
        const imageBuffers = await Promise.all(product.images.map((img) => fetchImageBuffer(img.src)));
        const validImages = imageBuffers
          .map((buffer, i) => ({ buffer, index: i }))
          .filter((x): x is { buffer: Buffer; index: number } => x.buffer !== null);
        // eslint-disable-next-line no-await-in-loop
        const uploads = await Promise.all(
          validImages.map((x) => storageProvider.uploadImage(x.buffer, `${Date.now()}-${x.index}-shopify.jpg`, folder)),
        );
        const imageUrls = uploads.map((u) => u.url);

        const variants = this.mapVariants(product);
        const firstVariantPrice = product.variants[0]?.price ?? 0;
        const sellerPrice = variants ? Math.min(...variants.map((v) => v.priceTiers![0].sellerPrice)) : firstVariantPrice;
        const declaredStock = product.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);

        const createInput: CreateProductInput = {
          name: product.title,
          description: stripHtml(product.bodyHtml) || product.title,
          categoryId: input.categoryId,
          materials: '',
          moq: 0,
          declaredStock,
          sellerPrice,
          variants,
          shopifyConnectionId: connection.id,
          shopifyProductId: product.id,
        };

        // eslint-disable-next-line no-await-in-loop
        const created = await this.productsRepo.create(
          sellerProfileId,
          { ...createInput, slug, id },
          imageUrls,
          [],
          { approvalStatus: ProductApprovalStatus.DRAFT },
        );

        result.imported.push({ shopifyProductId, productId: created.id });
      } catch (err) {
        logger.warn({ err, shopifyProductId }, 'Shopify import: product import failed');
        result.failed.push({ shopifyProductId, reason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return result;
  }

  /** The recurring (and manually-triggered) sync entrypoint — a plain,
   *  directly-testable method the BullMQ worker just calls. See AGENTS.md-adjacent
   *  plan doc for the inventory-always-direct / price-staged-once-live rule. */
  async syncConnection(connectionId: string): Promise<void> {
    const connection = await this.repo.findConnectionById(connectionId);
    if (!connection || !connection.syncEnabled) return;

    let accessToken: string;
    try {
      accessToken = decryptSecret(connection.accessTokenCiphertext);
    } catch (err) {
      logger.warn({ err, connectionId }, 'Shopify sync: could not decrypt stored token');
      await this.repo.updateConnection(connectionId, { lastSyncError: 'Could not decrypt stored credentials' });
      return;
    }

    try {
      const products = await this.repo.findSyncableProducts(connectionId);
      for (const product of products) {
        if (!product.shopifyProductId) continue;
        // eslint-disable-next-line no-await-in-loop
        const shopifyProduct = await shopifyProvider.getProduct(
          connection.shopDomain,
          accessToken,
          product.shopifyProductId,
        );
        // eslint-disable-next-line no-await-in-loop
        await this.syncOneProduct(product, shopifyProduct);
      }
      await this.repo.updateConnection(connectionId, { lastSyncedAt: new Date(), lastSyncError: null });
    } catch (err) {
      logger.warn({ err, connectionId }, 'Shopify sync: connection sync failed');
      await this.repo.updateConnection(connectionId, {
        lastSyncError: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private async syncOneProduct(product: SyncableProduct, shopifyProduct: ShopifyProduct): Promise<void> {
    // --- Inventory always applies directly, regardless of approval status ---
    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        const shopifyVariant = shopifyProduct.variants.find((v) => v.id === variant.shopifyVariantId);
        if (shopifyVariant && shopifyVariant.inventoryQuantity !== (variant.inventory ?? 0)) {
          // eslint-disable-next-line no-await-in-loop
          await this.repo.updateVariantInventory(variant.id, shopifyVariant.inventoryQuantity);
        }
      }
    }
    const totalInventory = shopifyProduct.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
    if (totalInventory !== product.declaredStock) {
      await this.productsRepo.update(product.id, { declaredStock: totalInventory }, [], 0);
    }

    // --- Price: applies directly only while not yet live; staged once APPROVED ---
    const mappedVariants = this.mapVariants(shopifyProduct);
    const cheapestPrice = shopifyProduct.variants.length
      ? Math.min(...shopifyProduct.variants.map((v) => v.price))
      : Number(product.sellerPrice);
    if (cheapestPrice === Number(product.sellerPrice)) return;

    if (product.approvalStatus === ProductApprovalStatus.APPROVED) {
      const proposed: ProposedPricing = {
        moq: product.moq,
        sellerPrice: cheapestPrice,
        priceTiers: [],
        variants: mappedVariants ?? [],
      };
      await this.productsRepo.upsertPendingPricingChange(product.id, proposed);
    } else {
      await this.productsRepo.update(product.id, { sellerPrice: cheapestPrice, variants: mappedVariants }, [], 0);
    }
  }
}

export const shopifyImportService = new ShopifyImportService();
