-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "shopifyVariantId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "shopifyConnectionId" TEXT,
ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "shopifySyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "shopify_connections" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessTokenCiphertext" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_connections_sellerId_key" ON "shopify_connections"("sellerId");

-- CreateIndex
CREATE INDEX "products_shopifyConnectionId_idx" ON "products"("shopifyConnectionId");

-- AddForeignKey
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopifyConnectionId_fkey" FOREIGN KEY ("shopifyConnectionId") REFERENCES "shopify_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
