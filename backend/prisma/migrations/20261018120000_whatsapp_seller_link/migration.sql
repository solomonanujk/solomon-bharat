-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN "whatsappNumber" TEXT,
ADD COLUMN "whatsappVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "whatsapp_link_codes" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_whatsappNumber_key" ON "seller_profiles"("whatsappNumber");

-- CreateIndex
CREATE INDEX "whatsapp_link_codes_sellerId_createdAt_idx" ON "whatsapp_link_codes"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsapp_link_codes" ADD CONSTRAINT "whatsapp_link_codes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
