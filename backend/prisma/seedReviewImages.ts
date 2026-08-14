/**
 * One-off / demo helper: attaches each product's own listing photos to its
 * seeded reviews as ReviewImage rows, purely so the new review-photo UI
 * (customer photo strip, review cards, detail modal, lightbox) has something
 * real to render without waiting on actual buyer-uploaded review photos.
 * Idempotent — a review that already has photos (e.g. a real upload) is left
 * alone.
 *
 * Run: npx tsx prisma/seedReviewImages.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isPublished: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
      reviews: { select: { id: true, images: { select: { id: true } } } },
    },
  });

  let reviewsTouched = 0;
  let photosAttached = 0;

  for (const product of products) {
    if (product.images.length === 0 || product.reviews.length === 0) continue;

    for (const [i, review] of product.reviews.entries()) {
      if (review.images.length > 0) continue; // already has photos — leave as-is

      const count = product.images.length >= 2 ? 2 : 1;
      const urls = Array.from({ length: count }, (_, k) => product.images[(i + k) % product.images.length].url);

      await prisma.reviewImage.createMany({
        data: urls.map((url, sortOrder) => ({ reviewId: review.id, url, sortOrder })),
      });

      reviewsTouched++;
      photosAttached += urls.length;
    }

    console.log(`"${product.name}" — attached photos to its reviews`);
  }

  console.log(`Done. ${photosAttached} photos attached across ${reviewsTouched} reviews.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
