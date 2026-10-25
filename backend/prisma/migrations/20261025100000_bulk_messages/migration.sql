-- CreateEnum
CREATE TYPE "BulkTemplateCategory" AS ENUM ('MARKETING', 'UTILITY');

-- CreateEnum
CREATE TYPE "BulkTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BulkCampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BulkRecipientStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "whatsappOptedOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bulk_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BulkTemplateCategory" NOT NULL DEFAULT 'UTILITY',
    "language" TEXT NOT NULL DEFAULT 'en',
    "headerText" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" JSONB,
    "variableExamples" JSONB NOT NULL DEFAULT '[]',
    "metaTemplateId" TEXT,
    "status" "BulkTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "BulkCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" JSONB NOT NULL,
    "variableMapping" JSONB NOT NULL DEFAULT '[]',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "status" "BulkRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_replies" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readByAdminAt" TIMESTAMP(3),

    CONSTRAINT "bulk_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulk_templates_status_idx" ON "bulk_templates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_templates_name_language_key" ON "bulk_templates"("name", "language");

-- CreateIndex
CREATE INDEX "bulk_campaigns_status_idx" ON "bulk_campaigns"("status");

-- CreateIndex
CREATE INDEX "bulk_campaigns_createdAt_idx" ON "bulk_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "bulk_recipients_campaignId_status_idx" ON "bulk_recipients"("campaignId", "status");

-- CreateIndex
CREATE INDEX "bulk_recipients_providerMessageId_idx" ON "bulk_recipients"("providerMessageId");

-- CreateIndex
CREATE INDEX "bulk_recipients_phone_sentAt_idx" ON "bulk_recipients"("phone", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_recipients_campaignId_sellerId_key" ON "bulk_recipients"("campaignId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_replies_providerMessageId_key" ON "bulk_replies"("providerMessageId");

-- CreateIndex
CREATE INDEX "bulk_replies_campaignId_receivedAt_idx" ON "bulk_replies"("campaignId", "receivedAt");

-- CreateIndex
CREATE INDEX "bulk_replies_readByAdminAt_idx" ON "bulk_replies"("readByAdminAt");

-- AddForeignKey
ALTER TABLE "bulk_campaigns" ADD CONSTRAINT "bulk_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "bulk_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_recipients" ADD CONSTRAINT "bulk_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "bulk_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_recipients" ADD CONSTRAINT "bulk_recipients_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_replies" ADD CONSTRAINT "bulk_replies_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "bulk_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_replies" ADD CONSTRAINT "bulk_replies_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "bulk_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

