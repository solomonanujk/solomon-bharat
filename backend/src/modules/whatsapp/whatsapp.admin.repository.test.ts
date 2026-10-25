import { beforeEach, describe, expect, it } from 'vitest';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { WhatsAppAdminRepository } from './whatsapp.admin.repository';

let db: MockPrismaClient;
let repo: WhatsAppAdminRepository;
const page = { page: 2, limit: 10 };

beforeEach(() => {
  db = buildMockPrismaClient({
    product: mockModel(),
    whatsAppSession: mockModel(),
    sellerProfile: mockModel(),
    whatsAppAiUsage: mockModel(),
  });
  repo = new WhatsAppAdminRepository(db as never);
});

describe('counts', () => {
  it('pending products are WhatsApp, PENDING and not deleted', async () => {
    db.product.count.mockResolvedValue(3);
    expect(await repo.countPendingProducts()).toBe(3);
    expect(db.product.count.mock.calls[0][0].where).toEqual({ source: 'WHATSAPP', approvalStatus: 'PENDING', deletedAt: null });
  });

  it('live listings are sessions that have not expired', async () => {
    const now = new Date('2026-10-25T10:00:00Z');
    db.whatsAppSession.count.mockResolvedValue(2);
    expect(await repo.countLiveSessions(now)).toBe(2);
    expect(db.whatsAppSession.count.mock.calls[0][0].where).toEqual({ expiresAt: { gt: now } });
  });

  it('linked sellers have a number and are not deleted', async () => {
    db.sellerProfile.count.mockResolvedValue(5);
    expect(await repo.countLinkedSellers()).toBe(5);
    expect(db.sellerProfile.count.mock.calls[0][0].where).toEqual({ whatsappNumber: { not: null }, deletedAt: null });
  });
});

describe('findLiveSessions', () => {
  it('lists unexpired sessions newest first, with the seller name and paging', async () => {
    const now = new Date('2026-10-25T10:00:00Z');
    db.whatsAppSession.findMany.mockResolvedValue([]);
    db.whatsAppSession.count.mockResolvedValue(0);
    await repo.findLiveSessions(now, page);
    const arg = db.whatsAppSession.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ expiresAt: { gt: now } });
    expect(arg.orderBy).toEqual({ lastMessageAt: 'desc' });
    expect(arg.include).toEqual({ seller: { select: { businessName: true } } });
    expect(arg).toMatchObject({ skip: 10, take: 10 });
  });
});

describe('findLinkedSellers', () => {
  it('only returns sellers with a number, newest link first', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    db.sellerProfile.count.mockResolvedValue(0);
    await repo.findLinkedSellers({}, page);
    const arg = db.sellerProfile.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: null, whatsappNumber: { not: null } });
    expect(arg.orderBy).toEqual({ whatsappVerifiedAt: 'desc' });
  });

  it('searches by business name or number', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    db.sellerProfile.count.mockResolvedValue(0);
    await repo.findLinkedSellers({ search: 'brass' }, page);
    expect(db.sellerProfile.findMany.mock.calls[0][0].where.OR).toEqual([
      { businessName: { contains: 'brass', mode: 'insensitive' } },
      { whatsappNumber: { contains: 'brass' } },
    ]);
  });
});

describe('per-seller counts', () => {
  it('counts WhatsApp products by seller', async () => {
    db.product.groupBy.mockResolvedValue([{ sellerId: 's1', _count: { _all: 4 } }]);
    const counts = await repo.countWhatsAppProductsBySeller(['s1', 's2']);
    expect(counts.get('s1')).toBe(4);
    expect(counts.get('s2')).toBeUndefined();
    expect(db.product.groupBy.mock.calls[0][0].where).toEqual({
      sellerId: { in: ['s1', 's2'] },
      source: 'WHATSAPP',
      deletedAt: null,
    });
  });

  it('reads AI calls for one day', async () => {
    db.whatsAppAiUsage.findMany.mockResolvedValue([{ sellerId: 's1', calls: 7 }]);
    const calls = await repo.aiCallsOn(['s1'], '2026-10-25');
    expect(calls.get('s1')).toBe(7);
    expect(db.whatsAppAiUsage.findMany.mock.calls[0][0].where).toEqual({ sellerId: { in: ['s1'] }, day: '2026-10-25' });
  });

  it('does not query for an empty list', async () => {
    expect((await repo.countWhatsAppProductsBySeller([])).size).toBe(0);
    expect((await repo.aiCallsOn([], '2026-10-25')).size).toBe(0);
    expect(db.product.groupBy).not.toHaveBeenCalled();
    expect(db.whatsAppAiUsage.findMany).not.toHaveBeenCalled();
  });
});
