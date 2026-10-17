ALTER TABLE "seller_applications" ADD COLUMN "isFavourite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "seller_applications" ADD COLUMN "favouritedById" TEXT;
ALTER TABLE "seller_applications" ADD COLUMN "favouritedAt" TIMESTAMP(3);
CREATE INDEX "seller_applications_isFavourite_idx" ON "seller_applications"("isFavourite");
