import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { ordersService } from './modules/orders/orders.service';
import { seedCraftCategories } from './modules/categories/craftCategories';
import { purgeDemoDataOnce } from './jobs/purgeDemoData';
import { cache } from './utils/cache';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Solomon Bharat API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
});

// One-time pre-launch cleanup first, then any missing craft categories, then clear the cached tree.
purgeDemoDataOnce(prisma)
  .catch((err) => logger.error({ err }, 'Launch purge failed'))
  .then(() => seedCraftCategories(prisma))
  .then(async (created) => {
    if (created > 0) {
      await cache.del('categories:public-tree');
      await cache.del('categories:public-tree:curated');
      logger.info({ created }, 'Craft categories added');
    }
  })
  .catch((err) => logger.error({ err }, 'Craft category seeding failed'));

// Cancels marketplace orders a brand has not accepted within 24h of payment.
const EXPIRY_SWEEP_MS = 10 * 60 * 1000;
const expirySweep = setInterval(() => {
  ordersService.expireUnacceptedBrandOrders().catch((err) => logger.error({ err }, 'Brand order expiry sweep failed'));
}, EXPIRY_SWEEP_MS);
expirySweep.unref();

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  clearInterval(expirySweep);
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
