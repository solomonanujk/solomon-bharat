import { Job, Worker } from 'bullmq';
import { logger } from '../config/logger';
import { shopifyImportRepository } from '../modules/shopify-import/shopify-import.repository';
import { shopifyImportService } from '../modules/shopify-import/shopify-import.service';
import { DISPATCH_JOB, QUEUE_NAME, shopifyQueueConnection, shopifySyncQueue, SYNC_CONNECTION_JOB } from './shopifySync.queue';

async function processJob(job: Job): Promise<void> {
  if (job.name === DISPATCH_JOB) {
    // Fans out one job per connection so a single slow/failing store never
    // blocks another's sync, and each connection gets BullMQ's own per-job
    // retry/logging for free.
    const connections = await shopifyImportRepository.findSyncEnabledConnections();
    await Promise.all(
      connections.map((connection) =>
        shopifySyncQueue.add(SYNC_CONNECTION_JOB, { connectionId: connection.id }),
      ),
    );
    return;
  }

  if (job.name === SYNC_CONNECTION_JOB) {
    const { connectionId } = job.data as { connectionId: string };
    await shopifyImportService.syncConnection(connectionId);
    return;
  }

  logger.warn({ jobName: job.name }, 'Shopify sync worker: unknown job name, skipping');
}

let worker: Worker | null = null;

/** Starts the in-process BullMQ worker — this app is a single Node process
 *  today, so the worker runs alongside Express rather than as a separate
 *  deployment target. Safe to call once at server startup. */
export function startShopifySyncWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(QUEUE_NAME, processJob, { connection: shopifyQueueConnection });
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, jobName: job?.name }, 'Shopify sync worker: job failed');
  });
  return worker;
}
