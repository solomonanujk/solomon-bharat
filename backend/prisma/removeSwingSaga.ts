/**
 * One-off: SWING SAGA's entire product catalog (67 products) references
 * images on their Shopify store that are now 404 — confirmed dead at the
 * source, not a migration bug (see conversation). Removing per business
 * decision: soft-delete their products (matches the existing soft-delete
 * convention products.repository.ts already uses for seller-initiated
 * deletes) and soft-delete + suspend their seller account.
 */
import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const seller = await prisma.sellerProfile.findFirst({
    where: { businessName: 'SWING SAGA', deletedAt: null },
    include: { user: true },
  });

  if (!seller) {
    console.log('No active SWING SAGA seller profile found — nothing to do.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id, deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`Found ${products.length} active products for SWING SAGA (seller ${seller.id}).`);

  const productDelete = await prisma.product.updateMany({
    where: { sellerId: seller.id, deletedAt: null },
    data: { deletedAt: new Date(), isPublished: false },
  });
  console.log(`Soft-deleted ${productDelete.count} products.`);

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: { deletedAt: new Date() },
  });
  console.log('Soft-deleted the SellerProfile.');

  await prisma.user.update({
    where: { id: seller.userId },
    data: { status: UserStatus.SUSPENDED },
  });
  console.log(`Suspended the login account (${seller.user.email}) — Users have no deletedAt field, this is the equivalent.`);

  // Report which collections these products belonged to, since the
  // ProductCollection join rows aren't removed (harmless — queries already
  // exclude soft-deleted products) but a collection could end up empty.
  const memberships = await prisma.productCollection.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { collection: { select: { id: true, name: true } } },
  });
  const affectedCollections = new Map<string, string>();
  for (const m of memberships) affectedCollections.set(m.collection.id, m.collection.name);

  for (const [collectionId, name] of affectedCollections) {
    const remaining = await prisma.productCollection.count({
      where: {
        collectionId,
        product: { deletedAt: null },
      },
    });
    console.log(`Collection "${name}" now has ${remaining} non-deleted product(s) left.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
