import { PrismaClient, Product, ProductVariant, ShopifyConnection, VariantPriceTier } from '@prisma/client';
import { prisma } from '../../config/prisma';

export type SyncableVariant = ProductVariant & { priceTiers: VariantPriceTier[] };
export type SyncableProduct = Product & { variants: SyncableVariant[] };

const IMPORTED_PRODUCT_INCLUDE = {
  variants: { include: { priceTiers: true } },
};

export class ShopifyImportRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findConnectionBySellerId(sellerId: string): Promise<ShopifyConnection | null> {
    return this.db.shopifyConnection.findUnique({ where: { sellerId } });
  }

  findConnectionById(id: string): Promise<ShopifyConnection | null> {
    return this.db.shopifyConnection.findUnique({ where: { id } });
  }

  findSyncEnabledConnections(): Promise<ShopifyConnection[]> {
    return this.db.shopifyConnection.findMany({ where: { syncEnabled: true } });
  }

  upsertConnection(
    sellerId: string,
    data: { shopDomain: string; accessTokenCiphertext: string },
  ): Promise<ShopifyConnection> {
    return this.db.shopifyConnection.upsert({
      where: { sellerId },
      create: { sellerId, ...data },
      // Reconnecting (e.g. a rotated token) clears any stale failure reason too.
      update: { ...data, lastSyncError: null },
    });
  }

  async deleteConnection(sellerId: string): Promise<void> {
    await this.db.shopifyConnection.delete({ where: { sellerId } });
  }

  updateConnection(
    id: string,
    data: Partial<Pick<ShopifyConnection, 'syncEnabled' | 'lastSyncedAt' | 'lastSyncError'>>,
  ): Promise<ShopifyConnection> {
    return this.db.shopifyConnection.update({ where: { id }, data });
  }

  /** Every product this connection previously imported that's still opted into sync. */
  findSyncableProducts(connectionId: string): Promise<SyncableProduct[]> {
    return this.db.product.findMany({
      where: { shopifyConnectionId: connectionId, shopifySyncEnabled: true, deletedAt: null },
      include: IMPORTED_PRODUCT_INCLUDE,
    });
  }

  /** Targeted inventory-only update for one variant — deliberately separate from
   *  the products module's "replace all variants" update path, since sync must
   *  apply inventory directly without touching price/attributes. */
  async updateVariantInventory(variantId: string, inventory: number): Promise<void> {
    await this.db.productVariant.update({ where: { id: variantId }, data: { inventory } });
  }
}

export const shopifyImportRepository = new ShopifyImportRepository();
