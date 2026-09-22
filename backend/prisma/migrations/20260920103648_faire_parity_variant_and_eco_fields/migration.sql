-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "dimensionUnit" TEXT DEFAULT 'cm',
ADD COLUMN     "height" DECIMAL(10,2),
ADD COLUMN     "inventory" INTEGER,
ADD COLUMN     "length" DECIMAL(10,2),
ADD COLUMN     "tariffCode" VARCHAR(50),
ADD COLUMN     "weight" DECIMAL(10,2),
ADD COLUMN     "weightUnit" TEXT DEFAULT 'kg',
ADD COLUMN     "width" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ecoMaterials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ecoPackaging" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ecoProduction" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isBestseller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tariffCode" VARCHAR(50);

-- CreateTable
CREATE TABLE "product_videos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_videos_productId_idx" ON "product_videos"("productId");

-- AddForeignKey
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

