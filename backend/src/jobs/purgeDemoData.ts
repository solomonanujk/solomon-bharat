import { PrismaClient, Role } from '@prisma/client';
import { logger } from '../config/logger';

/**
 * ONE-TIME pre-launch cleanup, requested and confirmed by the owner (nothing has been sold
 * yet; every record in the database is test data). Removes all sellers, brands, buyers,
 * agents, products, orders, reviews, collections, applications, requests and catalogues.
 * Keeps the category tree, platform settings, admin accounts and the admin audit log.
 * Guarded by a platform setting so it runs exactly once, on the first server start after
 * it ships.
 */
const DONE_KEY = 'launch_purge_v1_done';
const ADMIN_EMAIL = 'admin@solomonbharat.com';
/** bcrypt hash of the owner's admin password (the password itself is never stored). */
const ADMIN_PASSWORD_HASH = '$2b$12$BfZt0IhvxB7ueJM1zMLKReq7a7TSxWdPCLwdqDJo/Uyx46dW3Y6/S';

export async function purgeDemoDataOnce(db: PrismaClient): Promise<boolean> {
  if (await db.platformSetting.findUnique({ where: { key: DONE_KEY } })) return false;

  await db.$transaction(
    async (tx) => {
      // Content tables; CASCADE empties everything that references them.
      await tx.$executeRawUnsafe(
        'TRUNCATE TABLE "order_items", "orders", "payments", "payouts", "reviews", "review_images", "products", ' +
          '"collections", "catalogues", "rfqs", "brands", "seller_applications", "agent_applications", "messages" CASCADE',
      );
      // The house seller pointed at a profile that is about to go; it is recreated on demand.
      await tx.platformSetting.deleteMany({ where: { key: 'house_seller_profile_id' } });

      await tx.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: { passwordHash: ADMIN_PASSWORD_HASH, role: Role.SUPER_ADMIN, emailVerifiedAt: new Date() },
        create: { email: ADMIN_EMAIL, passwordHash: ADMIN_PASSWORD_HASH, role: Role.SUPER_ADMIN, emailVerifiedAt: new Date() },
      });
      // Every non-admin account (test sellers, buyers, agents) goes, with its profiles.
      await tx.user.deleteMany({ where: { role: { not: Role.SUPER_ADMIN } } });

      await tx.platformSetting.create({ data: { key: DONE_KEY, value: new Date().toISOString() } });
    },
    { timeout: 120_000 },
  );

  logger.warn('Launch purge done: test data removed; categories, settings and admins kept');
  return true;
}
