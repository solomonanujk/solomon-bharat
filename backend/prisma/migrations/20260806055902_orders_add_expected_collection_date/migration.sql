-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "expectedCollectionDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
