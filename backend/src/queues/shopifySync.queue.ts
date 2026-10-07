import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

export const QUEUE_NAME = 'shopify-sync';
export const DISPATCH_JOB = 'dispatch';
export const SYNC_CONNECTION_JOB = 'sync-connection';
export const DISPATCH_REPEAT_JOB_ID = 'shopify-sync-dispatch';
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// BullMQ requires its own connection with maxRetriesPerRequest: null (for its
// blocking commands) — the shared `config/redis.ts` export is configured
// with maxRetriesPerRequest: 3 for ordinary caching use and must not be
// reused here.
export const shopifyQueueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const shopifySyncQueue = new Queue(QUEUE_NAME, { connection: shopifyQueueConnection });

/** Registers the recurring dispatch job — safe to call on every server start:
 *  `upsertJobScheduler` is keyed by `DISPATCH_REPEAT_JOB_ID`, so a restart
 *  updates the existing schedule rather than creating a duplicate. */
export async function registerShopifySyncDispatch(): Promise<void> {
  await shopifySyncQueue.upsertJobScheduler(DISPATCH_REPEAT_JOB_ID, { every: SYNC_INTERVAL_MS }, { name: DISPATCH_JOB });
}
