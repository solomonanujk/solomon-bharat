-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('WEB', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "WhatsAppSessionState" AS ENUM ('COLLECTING', 'AWAITING_ANSWERS', 'AWAITING_CONFIRM');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "source" "ProductSource" NOT NULL DEFAULT 'WEB';

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" "WhatsAppSessionState" NOT NULL DEFAULT 'COLLECTING',
    "language" TEXT NOT NULL DEFAULT 'en',
    "texts" TEXT[],
    "imageUrls" TEXT[],
    "videoUrls" TEXT[],
    "collected" JSONB NOT NULL DEFAULT '{}',
    "missing" TEXT[],
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_ai_usage" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "whatsapp_ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_phone_key" ON "whatsapp_sessions"("phone");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_expiresAt_idx" ON "whatsapp_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_ai_usage_sellerId_day_key" ON "whatsapp_ai_usage"("sellerId", "day");

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_ai_usage" ADD CONSTRAINT "whatsapp_ai_usage_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
