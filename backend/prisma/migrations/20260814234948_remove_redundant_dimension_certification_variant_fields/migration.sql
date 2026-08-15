-- Backfill: compose the structured lengthCm/breadthCm/heightCm columns into the
-- legacy free-text `dimensions` column before dropping them, so no product loses
-- its recorded dimensions.
UPDATE "products"
SET "dimensions" = CONCAT_WS(' x ',
    "lengthCm"::text,
    "breadthCm"::text,
    "heightCm"::text
  ) || ' cm'
WHERE "lengthCm" IS NOT NULL OR "breadthCm" IS NOT NULL OR "heightCm" IS NOT NULL;

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "moq",
DROP COLUMN "sellerPrice",
DROP COLUMN "stock";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "breadthCm",
DROP COLUMN "certifications",
DROP COLUMN "heightCm",
DROP COLUMN "lengthCm";
