CREATE TYPE "GuideKnowledgeStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
ALTER TABLE "guide_knowledge" ADD COLUMN "status" "GuideKnowledgeStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "guide_knowledge" ADD COLUMN "error" TEXT;
ALTER TABLE "guide_knowledge" ADD COLUMN "summary" TEXT;
