-- AlterTable
ALTER TABLE "brands" ADD COLUMN "inviteCode" TEXT;
CREATE UNIQUE INDEX "brands_inviteCode_key" ON "brands"("inviteCode");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "brandOwnBuyer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "brand_own_buyers" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_own_buyers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_own_buyers_buyerId_brandId_key" ON "brand_own_buyers"("buyerId", "brandId");
CREATE INDEX "brand_own_buyers_brandId_idx" ON "brand_own_buyers"("brandId");

ALTER TABLE "brand_own_buyers" ADD CONSTRAINT "brand_own_buyers_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_own_buyers" ADD CONSTRAINT "brand_own_buyers_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
