-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'QUALITY_CHECKED' BEFORE 'IN_TRANSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "dispatchPhotos" JSONB,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundReference" TEXT;

-- Backfill: orders already past payment count as paid at their last update.
UPDATE "orders" SET "paidAt" = "updatedAt"
WHERE "status" NOT IN ('PENDING_PAYMENT', 'CANCELLED') AND "paidAt" IS NULL;

CREATE INDEX "orders_status_paidAt_idx" ON "orders"("status", "paidAt");
