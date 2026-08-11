import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Payout, PayoutStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PayoutsRepository } from './payouts.repository';
import { PayoutsService } from './payouts.service';

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/prisma', () => ({
  prisma: {
    sellerProfile: { findUnique: vi.fn().mockResolvedValue({ userId: 'seller-user-1' }) },
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifyPayoutPaid: vi.fn().mockResolvedValue(undefined),
  },
}));

function buildPayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'payout-1',
    sellerId: 'seller-1',
    orderId: 'order-1',
    orderItemId: 'item-1',
    amount: new Decimal(50),
    status: PayoutStatus.PENDING,
    paidAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): PayoutsRepository {
  return {
    findById: vi.fn(),
    existsForOrder: vi.fn(),
    createManyForOrder: vi.fn(),
    markPaid: vi.fn(),
    setNotes: vi.fn(),
    findForSeller: vi.fn(),
    findForAdmin: vi.fn(),
    sumForSeller: vi.fn(),
    findLastPaidForSeller: vi.fn(),
  } as unknown as PayoutsRepository;
}

describe('PayoutsService', () => {
  let repo: PayoutsRepository;
  let service: PayoutsService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new PayoutsService(repo);
  });

  describe('createForOrder', () => {
    it('is idempotent — does not create duplicate payouts if called twice for the same order', async () => {
      vi.mocked(repo.existsForOrder).mockResolvedValue(true);

      await service.createForOrder('order-1');

      expect(repo.createManyForOrder).not.toHaveBeenCalled();
    });

    it('creates payouts when none exist yet for the order', async () => {
      vi.mocked(repo.existsForOrder).mockResolvedValue(false);

      await service.createForOrder('order-1');

      expect(repo.createManyForOrder).toHaveBeenCalledWith('order-1');
    });
  });

  describe('markAsPaid', () => {
    it('rejects marking an already-paid payout as paid again', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildPayout({ status: PayoutStatus.PAID }));

      await expect(service.markAsPaid('payout-1', undefined, 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.markPaid).not.toHaveBeenCalled();
    });

    it('marks a pending payout as paid', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildPayout());
      vi.mocked(repo.markPaid).mockResolvedValue(buildPayout({ status: PayoutStatus.PAID }));

      const result = await service.markAsPaid('payout-1', 'paid via NEFT', 'admin-1');

      expect(repo.markPaid).toHaveBeenCalledWith('payout-1', 'paid via NEFT');
      expect(result.status).toBe(PayoutStatus.PAID);
    });
  });

  describe('getSellerSummary', () => {
    it('computes totalEarned from PAID and pendingPayout from PENDING separately', async () => {
      vi.mocked(repo.sumForSeller).mockImplementation((_sellerId: string, status: PayoutStatus) =>
        Promise.resolve(status === PayoutStatus.PAID ? 500 : 75),
      );
      vi.mocked(repo.findLastPaidForSeller).mockResolvedValue(
        buildPayout({ status: PayoutStatus.PAID, paidAt: new Date('2026-01-01') }),
      );

      const summary = await service.getSellerSummary('seller-1');

      expect(summary.totalEarned).toBe('500.00');
      expect(summary.pendingPayout).toBe('75.00');
      expect(summary.lastPayout?.amount).toBe('50');
    });

    it('returns null lastPayout when the seller has never been paid', async () => {
      vi.mocked(repo.sumForSeller).mockResolvedValue(0);
      vi.mocked(repo.findLastPaidForSeller).mockResolvedValue(null);

      const summary = await service.getSellerSummary('seller-1');

      expect(summary.lastPayout).toBeNull();
    });
  });

  describe('addNotes', () => {
    it('rejects adding notes to a payout that does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.addNotes('missing', 'note')).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.setNotes).not.toHaveBeenCalled();
    });

    it('sets notes on an existing payout', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildPayout());
      vi.mocked(repo.setNotes).mockResolvedValue(buildPayout({ notes: 'bank transfer pending' }));

      const result = await service.addNotes('payout-1', 'bank transfer pending');

      expect(repo.setNotes).toHaveBeenCalledWith('payout-1', 'bank transfer pending');
      expect(result.notes).toBe('bank transfer pending');
    });
  });

  describe('listForSeller / listForAdmin / getForAdmin', () => {
    it('listForSeller stringifies the Decimal amount for each row', async () => {
      vi.mocked(repo.findForSeller).mockResolvedValue({ data: [buildPayout()], total: 1 });

      const { data } = await service.listForSeller('seller-1', {}, { page: 1, limit: 20 });

      expect(data[0].amount).toBe('50');
    });

    it('listForAdmin stringifies the Decimal amount for each row', async () => {
      vi.mocked(repo.findForAdmin).mockResolvedValue({
        data: [{ ...buildPayout(), seller: { businessName: 'Jaipur Handicrafts' } }],
        total: 1,
      } as never);

      const { data } = await service.listForAdmin({}, { page: 1, limit: 20 });

      expect(data[0].amount).toBe('50');
    });

    it('getForAdmin throws 404 for a payout that does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.getForAdmin('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('getForAdmin returns the raw payout when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildPayout());

      const result = await service.getForAdmin('payout-1');

      expect(result.id).toBe('payout-1');
    });
  });
});
