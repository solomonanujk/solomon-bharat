-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN "isOnVacation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalRating" INTEGER,
ADD COLUMN "internalNotes" TEXT;
