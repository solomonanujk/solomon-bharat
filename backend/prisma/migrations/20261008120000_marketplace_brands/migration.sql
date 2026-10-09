-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('CURATED', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_ORDER_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'BRAND_APPLICATION_APPROVED';

-- AlterTable
ALTER TABLE "seller_applications" ADD COLUMN     "brandBannerUrl" TEXT,
ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "brandStory" TEXT,
ADD COLUMN     "brandWebsite" TEXT,
ADD COLUMN     "commissionAgreedAt" TIMESTAMP(3),
ADD COLUMN     "commissionTermsVersion" TEXT,
ADD COLUMN     "minOrderValueInr" DECIMAL(12,2),
ADD COLUMN     "sellerType" "SellerType" NOT NULL DEFAULT 'CURATED';

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "sellerType" "SellerType" NOT NULL DEFAULT 'CURATED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brandId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "sellerProfileId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "commissionAmount" DECIMAL(12,2),
ADD COLUMN     "commissionRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkoutId" TEXT;

-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "commissionAmount" DECIMAL(12,2),
ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "grossAmount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "story" TEXT,
    "country" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "returnPolicy" TEXT,
    "minOrderValueInr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionFirstOverride" DECIMAL(5,2),
    "commissionRepeatOverride" DECIMAL(5,2),
    "legalName" TEXT,
    "gstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_follows" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_sellerProfileId_key" ON "brands"("sellerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_status_idx" ON "brands"("status");

-- CreateIndex
CREATE INDEX "brand_follows_brandId_idx" ON "brand_follows"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_follows_buyerId_brandId_key" ON "brand_follows"("buyerId", "brandId");

-- CreateIndex
CREATE INDEX "seller_profiles_sellerType_idx" ON "seller_profiles"("sellerType");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "orders_sellerProfileId_idx" ON "orders"("sellerProfileId");

-- CreateIndex
CREATE INDEX "orders_checkoutId_idx" ON "orders"("checkoutId");

-- CreateIndex
CREATE INDEX "payments_checkoutId_idx" ON "payments"("checkoutId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_follows" ADD CONSTRAINT "brand_follows_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_follows" ADD CONSTRAINT "brand_follows_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Platform-wide default commission for marketplace brands (percent).
-- First paid order of a brand / every later order. Admin can override per brand.
INSERT INTO "platform_settings" ("key", "value", "updatedAt")
VALUES
  ('marketplace_commission_first', '25'::jsonb, NOW()),
  ('marketplace_commission_repeat', '15'::jsonb, NOW())
ON CONFLICT ("key") DO NOTHING;
