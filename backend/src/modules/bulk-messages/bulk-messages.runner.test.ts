import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/redis', () => ({ redis: { set: vi.fn(), get: vi.fn(), pexpire: vi.fn(), on: vi.fn() } }));

import { WhatsAppSendError } from '../../providers/whatsapp';
import { BulkRunner } from './bulk-messages.runner';

const recipient = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  phone: `+9198123400${id}`,
  variables: ['Asha', 'Friday'],
  attempts: 1,
  seller: { businessName: 'Biz', whatsappOptedOutAt: null },
  ...over,
});

function build(opts: { lock?: boolean; perSecond?: number } = {}) {
  const repo = {
    resetStaleSending: vi.fn().mockResolvedValue(0),
    findRunningCampaigns: vi.fn().mockResolvedValue([{ id: 'c1', template: { name: 'offer', language: 'en' } }]),
    claimBatch: vi.fn().mockResolvedValue([]),
    markSent: vi.fn().mockResolvedValue({}),
    markFailed: vi.fn().mockResolvedValue({}),
    requeue: vi.fn().mockResolvedValue({}),
    countOpen: vi.fn().mockResolvedValue(1),
    updateCampaign: vi.fn().mockResolvedValue({}),
    deleteRepliesOlderThan: vi.fn().mockResolvedValue(0),
  };
  const provider = { sendTemplate: vi.fn().mockResolvedValue({ messageId: 'wamid.1' }), sendText: vi.fn() };
  const lock = { acquire: vi.fn().mockResolvedValue(opts.lock ?? true) };
  let clock = 10_000_000_000;
  const runner = new BulkRunner(
    repo as never,
    provider as never,
    lock,
    { perSecond: opts.perSecond ?? 5, backoffMs: 60_000, maxAttempts: 3 },
    () => clock,
  );
  return { runner, repo, provider, lock, advance: (ms: number) => (clock += ms) };
}

let t: ReturnType<typeof build>;
beforeEach(() => {
  t = build();
});

describe('BulkRunner.tick', () => {
  it('sends the claimed recipients as the approved template and stores the message id', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01'), recipient('02')]);
    await t.runner.tick();
    expect(t.provider.sendTemplate).toHaveBeenCalledTimes(2);
    expect(t.provider.sendTemplate).toHaveBeenCalledWith('+919812340001', { name: 'offer', language: 'en', body: ['Asha', 'Friday'] });
    expect(t.repo.markSent).toHaveBeenCalledWith('01', 'wamid.1');
    expect(t.provider.sendText).not.toHaveBeenCalled();
  });

  it('claims no more than the per-second budget', async () => {
    t = build({ perSecond: 3 });
    await t.runner.tick();
    expect(t.repo.claimBatch).toHaveBeenCalledWith('c1', 3);
  });

  it('does nothing when another instance holds the lock', async () => {
    t = build({ lock: false });
    await t.runner.tick();
    expect(t.repo.findRunningCampaigns).not.toHaveBeenCalled();
  });

  it('marks the campaign completed when nothing is left to send', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01')]);
    t.repo.countOpen.mockResolvedValue(0);
    await t.runner.tick();
    expect(t.repo.updateCampaign.mock.calls[0][1]).toMatchObject({ status: 'COMPLETED' });
  });

  it('records a permanent refusal with its code and carries on with the rest', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01'), recipient('02')]);
    t.provider.sendTemplate
      .mockRejectedValueOnce(new WhatsAppSendError('Meta WhatsApp template send failed with 400 (code 131026: undeliverable)', 400, 131026, false))
      .mockResolvedValueOnce({ messageId: 'wamid.2' });
    await t.runner.tick();
    expect(t.repo.markFailed).toHaveBeenCalledWith('01', 131026, expect.stringContaining('undeliverable'));
    expect(t.repo.markSent).toHaveBeenCalledWith('02', 'wamid.2');
  });

  it('on a rate limit puts the recipient back and pauses all sending for a minute', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01')]);
    t.provider.sendTemplate.mockRejectedValueOnce(new WhatsAppSendError('rate limit', 400, 130429, true));
    await t.runner.tick();
    expect(t.repo.requeue).toHaveBeenCalledWith('01');
    expect(t.repo.markFailed).not.toHaveBeenCalled();

    t.repo.claimBatch.mockClear();
    t.advance(30_000);
    await t.runner.tick();
    expect(t.repo.claimBatch).not.toHaveBeenCalled();

    t.advance(31_000);
    await t.runner.tick();
    expect(t.repo.claimBatch).toHaveBeenCalled();
  });

  it('gives up on a recipient after the maximum attempts', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01', { attempts: 3 })]);
    t.provider.sendTemplate.mockRejectedValueOnce(new WhatsAppSendError('outage', 503, undefined, true));
    await t.runner.tick();
    expect(t.repo.requeue).not.toHaveBeenCalled();
    expect(t.repo.markFailed).toHaveBeenCalledWith('01', undefined, expect.stringContaining('gave up after 3 tries'));
  });

  it('skips a seller who replied STOP after the audience was frozen', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01', { seller: { businessName: 'Biz', whatsappOptedOutAt: new Date() } })]);
    await t.runner.tick();
    expect(t.provider.sendTemplate).not.toHaveBeenCalled();
    expect(t.repo.markFailed).toHaveBeenCalledWith('01', undefined, expect.stringContaining('opted out'));
  });

  it('records an unexpected error without stopping the round', async () => {
    t.repo.claimBatch.mockResolvedValue([recipient('01'), recipient('02')]);
    t.provider.sendTemplate.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});
    await t.runner.tick();
    expect(t.repo.markFailed).toHaveBeenCalledWith('01', undefined, 'boom');
    expect(t.repo.markSent).toHaveBeenCalledWith('02', undefined);
  });

  it('survives a database error in a round', async () => {
    t.repo.findRunningCampaigns.mockRejectedValue(new Error('db down'));
    await expect(t.runner.tick()).resolves.toBeUndefined();
  });

  it('deletes old replies about once an hour', async () => {
    await t.runner.tick();
    await t.runner.tick();
    expect(t.repo.deleteRepliesOlderThan).toHaveBeenCalledTimes(1);
    t.advance(61 * 60 * 1000);
    await t.runner.tick();
    expect(t.repo.deleteRepliesOlderThan).toHaveBeenCalledTimes(2);
  });
});

describe('BulkRunner.start', () => {
  it('returns unfinished sends from a previous process to the queue', async () => {
    t.repo.resetStaleSending.mockResolvedValue(4);
    await t.runner.start();
    expect(t.repo.resetStaleSending).toHaveBeenCalled();
    t.runner.stop();
  });
});
