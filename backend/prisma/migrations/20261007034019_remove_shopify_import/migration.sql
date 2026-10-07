-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_shopifyConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "shopify_connections" DROP CONSTRAINT "shopify_connections_sellerId_fkey";

-- DropIndex
DROP INDEX "products_shopifyConnectionId_idx";

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "shopifyVariantId";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "shopifyConnectionId",
DROP COLUMN "shopifyProductId",
DROP COLUMN "shopifySyncEnabled";

-- DropTable
DROP TABLE "shopify_connections";

