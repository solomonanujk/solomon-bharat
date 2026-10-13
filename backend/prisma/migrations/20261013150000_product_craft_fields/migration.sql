-- AlterTable
ALTER TABLE "products" ADD COLUMN "craftTechnique" TEXT,
ADD COLUMN "careInstructions" TEXT,
ADD COLUMN "isMadeToOrder" BOOLEAN NOT NULL DEFAULT false;
