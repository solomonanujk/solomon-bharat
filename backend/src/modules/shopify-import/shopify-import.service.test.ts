import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductApprovalStatus } from '@prisma/client';
import type { ShopifyConnection } from '@prisma/client';
import { ShopifyImportService } from './shopify-import.service';
import type { ShopifyImportRepository, SyncableProduct } from './shopify-import.repository';
import type { ProductsRepository } from '../products/products.repository';
import type { CategoriesService } from '../categories/categories.service';
import type { ShopifyProduct } from '../../providers/shopify';

vi.mock('../../utils/crypto', () => ({
  encryptSecret: (plain: string) => `enc:${plain}`,
  decryptSecret: (ciphertext: string) => ciphertext.replace(/^enc:/, ''),
}));

vi.mock('../../providers/storage', () => ({
  storageProvider: {
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/img.jpg', publicId: 'img' }),
  },
}));

vi.mock('../../providers/shopify', () => ({
  shopifyProvider: {
    verifyConnection: vi.fn(),
    listProducts: vi.fn(),
    getProduct: vi.fn(),
  },
}));

vi.mock('../../queues/shopifySync.queue', () => ({
  shopifySyncQueue: { add: vi.fn() },
  SYNC_CONNECTION_JOB: 'sync-connection',
}));

import { shopifyProvider } from '../../providers/shopify';
import { shopifySyncQueue } from '../../queues/shopifySync.queue';

function buildConnection(overrides: Partial<ShopifyConnection> = {}): ShopifyConnection {
  return {
    id: 'conn-1',
    sellerId: 'seller-1',
    shopDomain: 'my-shop.myshopify.com',
    accessTokenCiphertext: 'enc:real-token',
    syncEnabled: true,
    lastSyncedAt: null,
    lastSyncError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildShopifyProduct(overrides: Partial<ShopifyProduct> = {}): ShopifyProduct {
  return {
    id: 'shopify-prod-1',
    title: 'Handwoven Table Runner',
    bodyHtml: '<p>Nice runner</p>',
    images: [{ id: 'img-1', src: 'https://shopify.example/img1.jpg' }],
    options: [],
    variants: [
      { id: 'shopify-var-1', title: 'Default', price: 499, sku: 'SKU-1', inventoryQuantity: 10, option1: null, option2: null, option3: null },
    ],
    ...overrides,
  };
}

function buildMockShopifyRepo(): ShopifyImportRepository {
  return {
    findConnectionBySellerId: vi.fn(),
    findConnectionById: vi.fn(),
    findSyncEnabledConnections: vi.fn(),
    upsertConnection: vi.fn(),
    deleteConnection: vi.fn(),
    updateConnection: vi.fn(),
    findSyncableProducts: vi.fn(),
    updateVariantInventory: vi.fn(),
  } as unknown as ShopifyImportRepository;
}

function buildMockProductsRepo(): ProductsRepository {
  return {
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    update: vi.fn(),
    upsertPendingPricingChange: vi.fn(),
  } as unknown as ProductsRepository;
}

function buildMockCategoriesService(): CategoriesService {
  return {
    assertValidLeafCategory: vi.fn().mockResolvedValue({ id: 'cat-1', level: 3 }),
  } as unknown as CategoriesService;
}

describe('ShopifyImportService', () => {
  let repo: ShopifyImportRepository;
  let productsRepo: ProductsRepository;
  let categories: CategoriesService;
  let service: ShopifyImportService;

  beforeEach(() => {
    vi.clearAllMocks();
    // fetchImageBuffer() uses the global fetch directly (it's not a provider) —
    // stub it so image "downloads" succeed without a real network call.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    repo = buildMockShopifyRepo();
    productsRepo = buildMockProductsRepo();
    categories = buildMockCategoriesService();
    service = new ShopifyImportService(repo, productsRepo, categories);
  });

  describe('connect', () => {
    it('verifies before storing, then encrypts the token', async () => {
      vi.mocked(shopifyProvider.verifyConnection).mockResolvedValue({ shopName: 'My Shop' });
      vi.mocked(repo.upsertConnection).mockResolvedValue(buildConnection());

      const result = await service.connect('seller-1', { shopDomain: 'my-shop.myshopify.com', accessToken: 'real-token' });

      expect(shopifyProvider.verifyConnection).toHaveBeenCalledWith('my-shop.myshopify.com', 'real-token');
      expect(repo.upsertConnection).toHaveBeenCalledWith('seller-1', {
        shopDomain: 'my-shop.myshopify.com',
        accessTokenCiphertext: 'enc:real-token',
      });
      expect(result.connected).toBe(true);
    });

    it('rejects and stores nothing when verification fails', async () => {
      vi.mocked(shopifyProvider.verifyConnection).mockRejectedValue(new Error('401'));

      await expect(
        service.connect('seller-1', { shopDomain: 'my-shop.myshopify.com', accessToken: 'bad-token' }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.upsertConnection).not.toHaveBeenCalled();
    });
  });

  describe('triggerSync', () => {
    it('enqueues a sync job for the resolved connection', async () => {
      vi.mocked(repo.findConnectionBySellerId).mockResolvedValue(buildConnection());

      await service.triggerSync('seller-1');

      expect(shopifySyncQueue.add).toHaveBeenCalledWith('sync-connection', { connectionId: 'conn-1' });
    });
  });

  describe('importProducts', () => {
    beforeEach(() => {
      vi.mocked(repo.findConnectionBySellerId).mockResolvedValue(buildConnection());
    });

    it('imports a product as a DRAFT with images and no false-positive variants', async () => {
      vi.mocked(shopifyProvider.getProduct).mockResolvedValue(buildShopifyProduct());
      vi.mocked(productsRepo.create).mockResolvedValue({ id: 'product-1' } as never);

      const result = await service.importProducts('seller-1', {
        shopifyProductIds: ['shopify-prod-1'],
        categoryId: 'cat-1',
      });

      expect(categories.assertValidLeafCategory).toHaveBeenCalledWith('cat-1');
      expect(productsRepo.create).toHaveBeenCalledWith(
        'seller-1',
        expect.objectContaining({
          name: 'Handwoven Table Runner',
          categoryId: 'cat-1',
          sellerPrice: 499,
          declaredStock: 10,
          shopifyConnectionId: 'conn-1',
          shopifyProductId: 'shopify-prod-1',
          variants: undefined, // single Shopify variant => not a "real" variant here
        }),
        ['https://cdn.example.com/img.jpg'],
        [],
        { approvalStatus: ProductApprovalStatus.DRAFT },
      );
      expect(result.imported).toEqual([{ shopifyProductId: 'shopify-prod-1', productId: 'product-1' }]);
      expect(result.failed).toEqual([]);
    });

    it('maps multi-variant products onto this platform’s variant model', async () => {
      vi.mocked(shopifyProvider.getProduct).mockResolvedValue(
        buildShopifyProduct({
          options: [{ name: 'Size', values: ['S', 'M'] }],
          variants: [
            { id: 'v1', title: 'S', price: 400, sku: 'SKU-S', inventoryQuantity: 5, option1: 'S', option2: null, option3: null },
            { id: 'v2', title: 'M', price: 450, sku: 'SKU-M', inventoryQuantity: 7, option1: 'M', option2: null, option3: null },
          ],
        }),
      );
      vi.mocked(productsRepo.create).mockResolvedValue({ id: 'product-1' } as never);

      await service.importProducts('seller-1', { shopifyProductIds: ['shopify-prod-1'], categoryId: 'cat-1' });

      expect(productsRepo.create).toHaveBeenCalledWith(
        'seller-1',
        expect.objectContaining({
          sellerPrice: 400, // cheapest variant
          declaredStock: 12,
          variants: [
            expect.objectContaining({ type: 'Size', value: 'S', shopifyVariantId: 'v1', inventory: 5 }),
            expect.objectContaining({ type: 'Size', value: 'M', shopifyVariantId: 'v2', inventory: 7 }),
          ],
        }),
        expect.any(Array),
        [],
        expect.anything(),
      );
    });

    it('reports one failing product without aborting the rest of the batch', async () => {
      vi.mocked(shopifyProvider.getProduct)
        .mockResolvedValueOnce(buildShopifyProduct({ id: 'shopify-prod-1' }))
        .mockResolvedValueOnce(buildShopifyProduct({ id: 'shopify-prod-2' }));
      vi.mocked(productsRepo.create)
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`sku`)'))
        .mockResolvedValueOnce({ id: 'product-2' } as never);

      const result = await service.importProducts('seller-1', {
        shopifyProductIds: ['shopify-prod-1', 'shopify-prod-2'],
        categoryId: 'cat-1',
      });

      expect(result.failed).toEqual([
        { shopifyProductId: 'shopify-prod-1', reason: 'Unique constraint failed on the fields: (`sku`)' },
      ]);
      expect(result.imported).toEqual([{ shopifyProductId: 'shopify-prod-2', productId: 'product-2' }]);
    });
  });

  describe('syncConnection', () => {
    function buildSyncableProduct(overrides: Partial<SyncableProduct> = {}): SyncableProduct {
      return {
        id: 'product-1',
        approvalStatus: ProductApprovalStatus.DRAFT,
        sellerPrice: 499 as never,
        moq: 1,
        declaredStock: 10,
        shopifyProductId: 'shopify-prod-1',
        variants: [],
        ...overrides,
      } as SyncableProduct;
    }

    it('does nothing when sync is disabled on the connection', async () => {
      vi.mocked(repo.findConnectionById).mockResolvedValue(buildConnection({ syncEnabled: false }));

      await service.syncConnection('conn-1');

      expect(repo.findSyncableProducts).not.toHaveBeenCalled();
    });

    it('applies a price change directly while the product is still a DRAFT', async () => {
      vi.mocked(repo.findConnectionById).mockResolvedValue(buildConnection());
      vi.mocked(repo.findSyncableProducts).mockResolvedValue([buildSyncableProduct()]);
      vi.mocked(shopifyProvider.getProduct).mockResolvedValue(buildShopifyProduct({ variants: [
        { id: 'shopify-var-1', title: 'Default', price: 599, sku: 'SKU-1', inventoryQuantity: 10, option1: null, option2: null, option3: null },
      ] }));

      await service.syncConnection('conn-1');

      expect(productsRepo.update).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ sellerPrice: 599 }),
        [],
        0,
      );
      expect(productsRepo.upsertPendingPricingChange).not.toHaveBeenCalled();
      expect(repo.updateConnection).toHaveBeenCalledWith('conn-1', { lastSyncedAt: expect.any(Date), lastSyncError: null });
    });

    it('stages a price change through the pending-pricing-change path once the product is APPROVED — never applies it directly', async () => {
      vi.mocked(repo.findConnectionById).mockResolvedValue(buildConnection());
      vi.mocked(repo.findSyncableProducts).mockResolvedValue([
        buildSyncableProduct({ approvalStatus: ProductApprovalStatus.APPROVED }),
      ]);
      vi.mocked(shopifyProvider.getProduct).mockResolvedValue(buildShopifyProduct({ variants: [
        { id: 'shopify-var-1', title: 'Default', price: 599, sku: 'SKU-1', inventoryQuantity: 10, option1: null, option2: null, option3: null },
      ] }));

      await service.syncConnection('conn-1');

      expect(productsRepo.upsertPendingPricingChange).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ sellerPrice: 599, moq: 1 }),
      );
      // Price must never be written directly to an already-live product.
      expect(productsRepo.update).not.toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ sellerPrice: expect.anything() }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('applies an inventory change directly even on an APPROVED product', async () => {
      vi.mocked(repo.findConnectionById).mockResolvedValue(buildConnection());
      vi.mocked(repo.findSyncableProducts).mockResolvedValue([
        buildSyncableProduct({ approvalStatus: ProductApprovalStatus.APPROVED, declaredStock: 10 }),
      ]);
      vi.mocked(shopifyProvider.getProduct).mockResolvedValue(buildShopifyProduct({ variants: [
        { id: 'shopify-var-1', title: 'Default', price: 499, sku: 'SKU-1', inventoryQuantity: 25, option1: null, option2: null, option3: null },
      ] }));

      await service.syncConnection('conn-1');

      expect(productsRepo.update).toHaveBeenCalledWith('product-1', { declaredStock: 25 }, [], 0);
      expect(productsRepo.upsertPendingPricingChange).not.toHaveBeenCalled();
    });

    it('records lastSyncError and keeps going without throwing when a connection-level call fails', async () => {
      vi.mocked(repo.findConnectionById).mockResolvedValue(buildConnection());
      vi.mocked(repo.findSyncableProducts).mockRejectedValue(new Error('Shopify responded 401'));

      await service.syncConnection('conn-1');

      expect(repo.updateConnection).toHaveBeenCalledWith('conn-1', { lastSyncError: 'Shopify responded 401' });
    });
  });
});
