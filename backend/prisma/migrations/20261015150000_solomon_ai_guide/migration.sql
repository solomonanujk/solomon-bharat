CREATE TYPE "GuideKnowledgeKind" AS ENUM ('TEXT', 'PDF', 'IMAGE', 'SPREADSHEET');

CREATE TABLE "guide_knowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "GuideKnowledgeKind" NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guide_knowledge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "guide_knowledge_createdAt_idx" ON "guide_knowledge"("createdAt");

CREATE TABLE "guide_conversations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guide_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "guide_conversations_token_key" ON "guide_conversations"("token");
CREATE INDEX "guide_conversations_createdAt_idx" ON "guide_conversations"("createdAt");
CREATE INDEX "guide_conversations_email_idx" ON "guide_conversations"("email");
