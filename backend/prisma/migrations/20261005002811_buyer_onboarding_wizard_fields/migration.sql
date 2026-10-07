-- AlterTable
ALTER TABLE "buyer_profiles" ADD COLUMN     "businessOpenedYear" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "hearAboutUs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredLanguage" TEXT,
ADD COLUMN     "website" TEXT;

