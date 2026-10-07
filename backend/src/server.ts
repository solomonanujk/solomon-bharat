import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Solomon Bharat API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
