import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { registerShopifySyncDispatch, shopifyQueueConnection } from './queues/shopifySync.queue';
import { startShopifySyncWorker } from './queues/shopifySync.worker';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Solomon Bharat API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
});

const shopifySyncWorker = startShopifySyncWorker();
void registerShopifySyncDispatch().catch((err) => logger.error({ err }, 'Failed to register Shopify sync dispatch job'));

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await shopifySyncWorker.close();
    await shopifyQueueConnection.quit();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
