-- CreateEnum
CREATE TYPE "ProductPricingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_PRICING_CHANGE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_PRICING_CHANGE_REJECTED';

-- CreateTable
CREATE TABLE "product_pricing_change_requests" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ProductPricingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "proposedMoq" INTEGER NOT NULL,
    "proposedSellerPrice" DECIMAL(12,2) NOT NULL,
    "proposedPriceTiers" JSONB NOT NULL,
    "proposedVariants" JSONB NOT NULL,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pricing_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_pricing_change_requests_productId_status_idx" ON "product_pricing_change_requests"("productId", "status");

-- AddForeignKey
ALTER TABLE "product_pricing_change_requests" ADD CONSTRAINT "product_pricing_change_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

