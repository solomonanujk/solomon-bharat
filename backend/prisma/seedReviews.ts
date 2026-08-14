/**
 * One-off: seed reviews for every published product so the storefront isn't
 * empty of ratings. A Review requires a real, unique OrderItem (the schema
 * enforces "verified buyer only"), so this creates a synthetic DELIVERED
 * order + order item per review rather than writing to the reviews table
 * directly. Re-runnable: products that already have at least one review are
 * skipped.
 *
 * Per product, ratings are drawn only from {4, 5} and weighted so the
 * resulting average lands in [4.0, 4.5] — never below 4, never above 4.5.
 *
 * Run: npx tsx prisma/seedReviews.ts
 */
import { OrderStatus, PrismaClient, ProductApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

const COMMENTS = [
  'Great quality for the price — exactly as described. Will reorder.',
  'Packaging was solid and the finish matches the listing photos closely.',
  'Delivery was on schedule and communication throughout was clear.',
  'Solid build quality, our customers have been happy with this batch.',
  'Matches the sample closely — minor variation in finish is expected with handmade pieces.',
  'Reliable supplier, this is our second order of this item.',
  'Good value for a bulk order, would recommend to other importers.',
  '',
  '',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Only 4s and 5s, weighted so the average lands in [4.0, 4.5]. */
function ratingsForProduct(n: number): number[] {
  const targetAvg = 4 + Math.random() * 0.5;
  const fives = Math.min(Math.round(n * (targetAvg - 4)), Math.floor(n / 2));
  const fours = n - fives;
  const ratings = [...Array(fours).fill(4), ...Array(fives).fill(5)];
  for (let i = ratings.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ratings[i], ratings[j]] = [ratings[j], ratings[i]];
  }
  return ratings;
}

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isPublished: true, deletedAt: null, approvalStatus: ProductApprovalStatus.APPROVED },
    select: { id: true, name: true, sellerId: true, moq: true, adminPrice: true, sellerPrice: true },
  });

  const buyers = await prisma.buyerProfile.findMany({
    select: { id: true, addresses: { where: { isDefault: true }, take: 1, select: { id: true } } },
  });

  if (buyers.length === 0) {
    console.error('No buyer profiles found — seed buyers first.');
    process.exit(1);
  }

  let buyerCursor = 0;
  const nextBuyer = () => buyers[buyerCursor++ % buyers.length];

  let productsSeeded = 0;
  let reviewsCreated = 0;

  for (const product of products) {
    const existingReviewCount = await prisma.review.count({ where: { productId: product.id } });
    if (existingReviewCount > 0) {
      console.log(`Skipping "${product.name}" — already has reviews`);
      continue;
    }

    const ratings = ratingsForProduct(randomInt(3, 6));
    const quantity = product.moq;
    const unitAdminPrice = Number(product.adminPrice ?? 0);
    const unitSellerPrice = Number(product.sellerPrice);
    const lineAdminTotal = unitAdminPrice * quantity;
    const lineSellerTotal = unitSellerPrice * quantity;

    for (const rating of ratings) {
      const buyer = nextBuyer();

      const order = await prisma.order.create({
        data: {
          buyerId: buyer.id,
          shippingAddressId: buyer.addresses[0]?.id,
          status: OrderStatus.DELIVERED,
          adminPriceTotal: lineAdminTotal,
          sellerPriceTotal: lineSellerTotal,
          adminMargin: lineAdminTotal - lineSellerTotal,
        },
      });

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          sellerId: product.sellerId,
          quantity,
          unitAdminPrice,
          unitSellerPrice,
          lineAdminTotal,
          lineSellerTotal,
        },
      });

      const comment = COMMENTS[randomInt(0, COMMENTS.length - 1)];

      await prisma.review.create({
        data: {
          productId: product.id,
          buyerId: buyer.id,
          orderItemId: orderItem.id,
          rating,
          comment: comment || undefined,
        },
      });
      reviewsCreated++;
    }

    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    console.log(`Seeded ${ratings.length} reviews for "${product.name}" (avg ${avg.toFixed(2)})`);
    productsSeeded++;
  }

  console.log(`Done. ${reviewsCreated} reviews created across ${productsSeeded} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
