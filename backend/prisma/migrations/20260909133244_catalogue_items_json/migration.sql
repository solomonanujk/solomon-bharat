-- AlterTable
ALTER TABLE "catalogues" DROP COLUMN "productIds",
ADD COLUMN     "items" JSONB NOT NULL DEFAULT '[]';

-- Drop the default now that existing rows are backfilled — new inserts must
-- always supply items explicitly (Prisma schema has no @default on this field).
ALTER TABLE "catalogues" ALTER COLUMN "items" DROP DEFAULT;
