/**
 * One-off: approve every PENDING product with adminPrice = sellerPrice * 1.20,
 * using the real ProductsService.approveProduct() business logic (not a raw
 * Prisma update) — so this exercises the same code path as a human admin
 * clicking Approve, including the audit log entry and seller notification.
 */
import { PrismaClient, ProductApprovalStatus } from '@prisma/client';
import { productsService } from '../src/modules/products/products.service';

const prisma = new PrismaClient();
const MARKUP = 1.2;

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@solomonbharat.com';
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error(`Admin user "${adminEmail}" not found — run the main seed first`);

  const pending = await prisma.product.findMany({
    where: { approvalStatus: ProductApprovalStatus.PENDING },
    select: { id: true, name: true, sellerPrice: true },
  });

  console.log(`Found ${pending.length} PENDING products. Approving as ${adminEmail}...`);

  let approved = 0;
  for (const p of pending) {
    const adminPrice = Math.round(Number(p.sellerPrice) * MARKUP * 100) / 100;
    await productsService.approveProduct(p.id, adminPrice, admin.id);
    approved++;
    console.log(`  Approved: ${p.name} — sellerPrice ${p.sellerPrice} -> adminPrice ${adminPrice}`);
  }

  console.log(`Done. Approved ${approved} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
