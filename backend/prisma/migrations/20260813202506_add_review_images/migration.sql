-- CreateTable
CREATE TABLE "review_images" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_images_reviewId_idx" ON "review_images"("reviewId");

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

