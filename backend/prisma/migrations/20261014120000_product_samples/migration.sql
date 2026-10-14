-- AlterTable
ALTER TABLE "products" ADD COLUMN "offersSamples" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sampleMaxQty" INTEGER,
ADD COLUMN "samplePrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "rfqs" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
