import { BulkCampaignStatus } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import { WhatsAppProvider, WhatsAppSendError, whatsAppProvider } from '../../providers/whatsapp';
import { BulkMessagesRepository, RecipientWithSeller } from './bulk-messages.repository';
import { REPLY_RETENTION_DAYS } from './bulk-messages.service';

/**
 * Sends the queued recipients of RUNNING campaigns, a few per second, from inside the API process.
 *
 * - State lives in the database (BulkRecipient.status), so a restart or deploy resumes where it stopped.
 * - A Redis lock makes sure only one instance sends at a time (Render briefly runs two during a deploy).
 * - Templates are sent with `sendTemplate` directly, never with the "fall back to plain text" helper:
 *   plain text outside the 24-hour window is dropped by Meta, and the admin approved this exact template.
 */

const LOCK_KEY = 'bulk-messages:runner-lock';
const LOCK_TTL_MS = 8_000;
const TICK_MS = 1_000;
/** A rate-limit or outage answer pauses all sending for this long. */
const BACKOFF_MS = 60_000;
const MAX_ATTEMPTS = 3;
const MAINTENANCE_EVERY_MS = 60 * 60 * 1000;

export interface RunnerLock {
  /** True when this instance holds the lock for the next few seconds. */
  acquire(): Promise<boolean>;
}

export const redisLock = (token: string): RunnerLock => ({
  async acquire() {
    try {
      const mine = await redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX');
      if (mine === 'OK') return true;
      // Already ours from the previous tick: extend it.
      if ((await redis.get(LOCK_KEY)) === token) {
        await redis.pexpire(LOCK_KEY, LOCK_TTL_MS);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn({ err }, '[bulk] could not reach Redis for the sender lock, skipping this round');
      return false;
    }
  },
});

export interface RunnerConfig {
  perSecond: number;
  backoffMs: number;
  maxAttempts: number;
}

export class BulkRunner {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private pausedUntil = 0;
  private lastMaintenance = 0;

  constructor(
    private readonly repo: BulkMessagesRepository,
    private readonly provider: WhatsAppProvider,
    private readonly lock: RunnerLock,
    private readonly config: RunnerConfig = { perSecond: env.BULK_SEND_PER_SECOND, backoffMs: BACKOFF_MS, maxAttempts: MAX_ATTEMPTS },
    private readonly now: () => number = Date.now,
  ) {}

  /** Starts ticking. Stale in-flight sends from a previous process go back in the queue first. */
  async start(): Promise<void> {
    if (this.timer) return;
    try {
      const reset = await this.repo.resetStaleSending();
      if (reset > 0) logger.info({ reset }, '[bulk] returned unfinished sends to the queue');
    } catch (err) {
      logger.error({ err }, '[bulk] could not reset unfinished sends');
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One round: send up to `perSecond` queued recipients. Public so tests can drive it. */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.lock.acquire())) return;
      await this.maintenance();
      if (this.now() < this.pausedUntil) return;

      let budget = this.config.perSecond;
      for (const campaign of await this.repo.findRunningCampaigns()) {
        if (budget <= 0) break;
        const batch = await this.repo.claimBatch(campaign.id, budget);
        budget -= batch.length;
        const send = this.provider.sendTemplate?.bind(this.provider);
        const outcomes = await Promise.all(
          batch.map((r) => this.sendOne(r, campaign.template.name, campaign.template.language, send)),
        );
        if (outcomes.includes('backoff')) {
          this.pausedUntil = this.now() + this.config.backoffMs;
          logger.warn('[bulk] WhatsApp asked us to slow down, pausing sends for a minute');
          return;
        }
        if ((await this.repo.countOpen(campaign.id)) === 0) {
          await this.repo.updateCampaign(campaign.id, { status: BulkCampaignStatus.COMPLETED, completedAt: new Date() });
          logger.info({ campaignId: campaign.id }, '[bulk] campaign finished');
        }
      }
    } catch (err) {
      logger.error({ err }, '[bulk] sender round failed');
    } finally {
      this.busy = false;
    }
  }

  private async sendOne(
    recipient: RecipientWithSeller,
    templateName: string,
    language: string,
    send: WhatsAppProvider['sendTemplate'],
  ): Promise<'ok' | 'failed' | 'backoff'> {
    try {
      // The seller may have replied STOP after the audience was frozen.
      if (recipient.seller.whatsappOptedOutAt) {
        await this.repo.markFailed(recipient.id, undefined, 'Seller opted out of bulk messages');
        return 'failed';
      }
      if (!send) {
        await this.repo.markFailed(recipient.id, undefined, 'WhatsApp sending is not set up');
        return 'failed';
      }
      const result = await send(recipient.phone, {
        name: templateName,
        language,
        body: (recipient.variables as string[]) ?? [],
      });
      await this.repo.markSent(recipient.id, result?.messageId);
      return 'ok';
    } catch (err) {
      const sendError = err instanceof WhatsAppSendError ? err : null;
      if (sendError?.transient) {
        if (recipient.attempts >= this.config.maxAttempts) {
          await this.repo.markFailed(recipient.id, sendError.code, `${sendError.message} (gave up after ${recipient.attempts} tries)`);
          return 'failed';
        }
        await this.repo.requeue(recipient.id);
        return 'backoff';
      }
      const message = err instanceof Error ? err.message : 'Send failed';
      if (!sendError) logger.error({ err }, '[bulk] unexpected send error');
      await this.repo.markFailed(recipient.id, sendError?.code, message);
      return 'failed';
    }
  }

  /** Hourly housekeeping: old replies are deleted. */
  private async maintenance(): Promise<void> {
    if (this.now() - this.lastMaintenance < MAINTENANCE_EVERY_MS) return;
    this.lastMaintenance = this.now();
    try {
      const cutoff = new Date(this.now() - REPLY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const removed = await this.repo.deleteRepliesOlderThan(cutoff);
      if (removed > 0) logger.info({ removed }, '[bulk] old replies deleted');
    } catch (err) {
      logger.error({ err }, '[bulk] reply cleanup failed');
    }
  }
}

let runner: BulkRunner | null = null;

/** Starts the production sender once. Called from the server bootstrap, never from tests. */
export function startBulkRunner(): BulkRunner {
  if (!runner) {
    runner = new BulkRunner(new BulkMessagesRepository(), whatsAppProvider, redisLock(`${process.pid}-${Date.now()}`));
    void runner.start();
  }
  return runner;
}

