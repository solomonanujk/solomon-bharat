import { beforeEach, describe, expect, it } from 'vitest';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { BulkMessagesRepository } from './bulk-messages.repository';

let db: MockPrismaClient;
let repo: BulkMessagesRepository;

beforeEach(() => {
  db = buildMockPrismaClient({
    bulkTemplate: mockModel(),
    bulkCampaign: mockModel(),
    bulkRecipient: mockModel(),
    bulkReply: mockModel(),
    sellerProfile: mockModel(),
  });
  repo = new BulkMessagesRepository(db as never);
});

describe('findAudienceCandidates', () => {
  it('PICKED reads only the chosen sellers, never deleted ones', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    await repo.findAudienceCandidates({ mode: 'PICKED', sellerIds: ['a', 'b'] });
    expect(db.sellerProfile.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, id: { in: ['a', 'b'] } });
  });

  it('FILTERED combines type, listed-by-chat and search', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    await repo.findAudienceCandidates({
      mode: 'FILTERED',
      filters: { sellerType: 'CURATED', listedByChat: true, search: 'brass' },
    });
    const where = db.sellerProfile.findMany.mock.calls[0][0].where;
    expect(where.sellerType).toBe('CURATED');
    expect(where.products).toEqual({ some: { source: 'WHATSAPP', deletedAt: null } });
    expect(where.OR).toHaveLength(2);
  });

  it('CSV only asks for sellers whose email or number appears in the file', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    await repo.findAudienceCandidates({
      mode: 'CSV',
      csvKeyColumn: 'k',
      csvRows: [{ k: 'Asha@Example.com' }, { k: '+919812340001' }, { k: '' }],
    });
    const where = db.sellerProfile.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.OR[0]).toEqual({ whatsappNumber: { in: ['+919812340001'] } });
    expect(where.OR[1].phone.in).toContain('+919812340001');
    expect(where.OR[2]).toEqual({ user: { email: { in: ['asha@example.com'], mode: 'insensitive' } } });
  });

  it('ALL_LINKED reads every registered seller (the resolver skips the unlinked)', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    await repo.findAudienceCandidates({ mode: 'ALL_LINKED' });
    expect(db.sellerProfile.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
  });
});

describe('claimBatch', () => {
  it('marks the oldest queued recipients as sending, one more attempt each', async () => {
    db.bulkRecipient.findMany
      .mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'SENDING' }, { id: 'r2', status: 'SENDING' }]);
    db.bulkRecipient.updateMany.mockResolvedValue({ count: 2 });
    const batch = await repo.claimBatch('c1', 5);
    expect(batch).toHaveLength(2);
    expect(db.bulkRecipient.findMany.mock.calls[0][0]).toMatchObject({ where: { campaignId: 'c1', status: 'QUEUED' }, take: 5 });
    expect(db.bulkRecipient.updateMany.mock.calls[0][0]).toEqual({
      where: { id: { in: ['r1', 'r2'] }, status: 'QUEUED' },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });
  });

  it('returns nothing and changes nothing when the queue is empty', async () => {
    db.bulkRecipient.findMany.mockResolvedValue([]);
    expect(await repo.claimBatch('c1', 5)).toEqual([]);
    expect(db.bulkRecipient.updateMany).not.toHaveBeenCalled();
  });
});

describe('applyStatus (delivery receipts)', () => {
  const recipient = (status: string, extra = {}) => ({ id: 'r1', status, deliveredAt: null, ...extra });

  it('moves forward: SENT then DELIVERED then READ', async () => {
    db.bulkRecipient.findFirst.mockResolvedValue(recipient('SENT'));
    expect(await repo.applyStatus('w1', 'delivered')).toBe(true);
    expect(db.bulkRecipient.update.mock.calls[0][0].data).toMatchObject({ status: 'DELIVERED' });
    expect(db.bulkRecipient.update.mock.calls[0][0].data.deliveredAt).toBeInstanceOf(Date);

    db.bulkRecipient.findFirst.mockResolvedValue(recipient('DELIVERED'));
    expect(await repo.applyStatus('w1', 'read')).toBe(true);
    expect(db.bulkRecipient.update.mock.calls[1][0].data.readAt).toBeInstanceOf(Date);
  });

  it('ignores a late "delivered" after "read" and a repeated "sent"', async () => {
    db.bulkRecipient.findFirst.mockResolvedValue(recipient('READ'));
    expect(await repo.applyStatus('w1', 'delivered')).toBe(false);
    db.bulkRecipient.findFirst.mockResolvedValue(recipient('SENT'));
    expect(await repo.applyStatus('w1', 'sent')).toBe(false);
    expect(db.bulkRecipient.update).not.toHaveBeenCalled();
  });

  it('records a failure with its code, but not after the message was delivered', async () => {
    db.bulkRecipient.findFirst.mockResolvedValue(recipient('SENT'));
    expect(await repo.applyStatus('w1', 'failed', { code: 131049, message: 'Frequency cap' })).toBe(true);
    expect(db.bulkRecipient.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', errorCode: 131049, errorMessage: 'Frequency cap' });

    db.bulkRecipient.findFirst.mockResolvedValue(recipient('DELIVERED'));
    expect(await repo.applyStatus('w1', 'failed', { code: 1 })).toBe(false);
  });

  it('ignores receipts for messages that are not bulk messages', async () => {
    db.bulkRecipient.findFirst.mockResolvedValue(null);
    expect(await repo.applyStatus('unknown', 'delivered')).toBe(false);
  });
});

describe('replies and opt-out', () => {
  it('createReply returns null for a message id it already stored', async () => {
    db.bulkReply.create.mockRejectedValue({ code: 'P2002' });
    expect(await repo.createReply({} as never)).toBeNull();
  });

  it('createReply rethrows other errors', async () => {
    db.bulkReply.create.mockRejectedValue(new Error('db down'));
    await expect(repo.createReply({} as never)).rejects.toThrow('db down');
  });

  it('finds the newest bulk message sent to a number since a time', async () => {
    db.bulkRecipient.findFirst.mockResolvedValue(null);
    const since = new Date('2026-10-25T00:00:00Z');
    await repo.findRecentRecipientByPhone('+919812340001', since);
    expect(db.bulkRecipient.findFirst.mock.calls[0][0]).toEqual({
      where: { phone: '+919812340001', sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
    });
  });

  it('opting out stamps the seller, opting in clears it', async () => {
    db.sellerProfile.update.mockResolvedValue({});
    await repo.setOptedOut('s1', true);
    expect(db.sellerProfile.update.mock.calls[0][0].data.whatsappOptedOutAt).toBeInstanceOf(Date);
    await repo.setOptedOut('s1', false);
    expect(db.sellerProfile.update.mock.calls[1][0].data).toEqual({ whatsappOptedOutAt: null });
  });

  it('deletes replies past retention', async () => {
    db.bulkReply.deleteMany.mockResolvedValue({ count: 3 });
    const cutoff = new Date('2026-07-01T00:00:00Z');
    expect(await repo.deleteRepliesOlderThan(cutoff)).toBe(3);
    expect(db.bulkReply.deleteMany.mock.calls[0][0]).toEqual({ where: { receivedAt: { lt: cutoff } } });
  });
});

describe('statusCounts', () => {
  it('groups recipient counts by campaign and status', async () => {
    db.bulkRecipient.groupBy.mockResolvedValue([
      { campaignId: 'c1', status: 'SENT', _count: { _all: 4 } },
      { campaignId: 'c1', status: 'FAILED', _count: { _all: 1 } },
      { campaignId: 'c2', status: 'QUEUED', _count: { _all: 9 } },
    ]);
    expect(await repo.statusCounts(['c1', 'c2'])).toEqual({ c1: { SENT: 4, FAILED: 1 }, c2: { QUEUED: 9 } });
    expect(await repo.statusCounts([])).toEqual({});
  });
});
