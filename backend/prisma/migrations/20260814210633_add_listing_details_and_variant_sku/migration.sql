-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "moq" INTEGER,
ADD COLUMN     "sellerPrice" DECIMAL(12,2),
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "status" "VariantStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "artisanName" TEXT,
ADD COLUMN     "breadthCm" DOUBLE PRECISION,
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "howItIsMade" TEXT,
ADD COLUMN     "isGITagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isHandmade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lengthCm" DOUBLE PRECISION,
ADD COLUMN     "placeOfOrigin" TEXT,
ADD COLUMN     "stepQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "product_price_tiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "moq" INTEGER NOT NULL,
    "sellerPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "product_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_attributes" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "variant_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_price_tiers" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "moq" INTEGER NOT NULL,
    "sellerPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "variant_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_price_tiers_productId_idx" ON "product_price_tiers"("productId");

-- CreateIndex
CREATE INDEX "variant_attributes_variantId_idx" ON "variant_attributes"("variantId");

-- CreateIndex
CREATE INDEX "variant_price_tiers_variantId_idx" ON "variant_price_tiers"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- AddForeignKey
ALTER TABLE "product_price_tiers" ADD CONSTRAINT "product_price_tiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_price_tiers" ADD CONSTRAINT "variant_price_tiers_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

