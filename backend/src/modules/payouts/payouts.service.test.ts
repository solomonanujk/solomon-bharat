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
    grossAmount: null,
    commissionRate: null,
    commissionAmount: null,
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
    createManyForBrandOrder: vi.fn(),
    findOrderForPayout: vi.fn(),
    findPaidOrdersForBrand: vi.fn(),
    findPaidItemsForBrand: vi.fn(),
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

  describe('createForDeliveredBrandOrder', () => {
    it('creates the net/breakdown payouts for a brand order', async () => {
      vi.mocked(repo.findOrderForPayout).mockResolvedValue({ id: 'order-1', sellerProfileId: 'brand-1' });
      vi.mocked(repo.existsForOrder).mockResolvedValue(false);

      await service.createForDeliveredBrandOrder('order-1');

      expect(repo.createManyForBrandOrder).toHaveBeenCalledWith('order-1');
      expect(repo.createManyForOrder).not.toHaveBeenCalled();
    });

    it('is idempotent when payouts already exist', async () => {
      vi.mocked(repo.findOrderForPayout).mockResolvedValue({ id: 'order-1', sellerProfileId: 'brand-1' });
      vi.mocked(repo.existsForOrder).mockResolvedValue(true);

      await service.createForDeliveredBrandOrder('order-1');

      expect(repo.createManyForBrandOrder).not.toHaveBeenCalled();
    });

    it('ignores curated orders (their payouts are created at COLLECTED) and missing orders', async () => {
      vi.mocked(repo.findOrderForPayout).mockResolvedValueOnce({ id: 'order-1', sellerProfileId: null });
      await service.createForDeliveredBrandOrder('order-1');
      vi.mocked(repo.findOrderForPayout).mockResolvedValueOnce(null);
      await service.createForDeliveredBrandOrder('missing');

      expect(repo.createManyForBrandOrder).not.toHaveBeenCalled();
    });
  });

  describe('getBrandSalesStats', () => {
    it('aggregates gmv, commission, net, top products and a 30-day series', async () => {
      const today = new Date();
      vi.mocked(repo.findPaidOrdersForBrand).mockResolvedValue([
        { createdAt: today, adminPriceTotal: new Decimal(1000) },
        { createdAt: new Date('2020-01-01'), adminPriceTotal: new Decimal(500) },
      ]);
      vi.mocked(repo.findPaidItemsForBrand).mockResolvedValue([
        {
          productId: 'p1',
          quantity: 2,
          lineAdminTotal: new Decimal(1000),
          lineSellerTotal: new Decimal(750),
          commissionAmount: new Decimal(250),
          product: { name: 'Vase' },
        },
        {
          productId: 'p2',
          quantity: 1,
          lineAdminTotal: new Decimal(500),
          lineSellerTotal: new Decimal(425),
          commissionAmount: new Decimal(75),
          product: { name: 'Rug' },
        },
        {
          productId: 'p1',
          quantity: 1,
          lineAdminTotal: new Decimal(100),
          lineSellerTotal: new Decimal(85),
          commissionAmount: new Decimal(15),
          product: { name: 'Vase' },
        },
      ] as never);
      vi.mocked(repo.sumForSeller).mockResolvedValue(300);

      const stats = await service.getBrandSalesStats('brand-1');

      expect(stats.ordersCount).toBe(2);
      expect(stats.gmv).toBe(1500);
      expect(stats.commissionPaid).toBe(340);
      expect(stats.netEarned).toBe(1260);
      expect(stats.pendingPayout).toBe(300);
      expect(stats.topProducts[0]).toEqual({ productId: 'p1', name: 'Vase', units: 3, revenue: 1100 });
      expect(stats.last30Days).toHaveLength(30);
      expect(stats.last30Days.reduce((s, d) => s + d.orders, 0)).toBe(1);
    });

    it('returns zeros for a brand with no sales', async () => {
      vi.mocked(repo.findPaidOrdersForBrand).mockResolvedValue([]);
      vi.mocked(repo.findPaidItemsForBrand).mockResolvedValue([]);
      vi.mocked(repo.sumForSeller).mockResolvedValue(0);

      const stats = await service.getBrandSalesStats('brand-1');

      expect(stats).toMatchObject({ ordersCount: 0, gmv: 0, commissionPaid: 0, netEarned: 0, topProducts: [] });
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

    it('returns both the nested lastPayout and the flat lastPayoutAmount/lastPayoutDate fields', async () => {
      const paidAt = new Date('2026-01-01');
      vi.mocked(repo.sumForSeller).mockResolvedValue(0);
      vi.mocked(repo.findLastPaidForSeller).mockResolvedValue(buildPayout({ status: PayoutStatus.PAID, paidAt }));

      const summary = await service.getSellerSummary('seller-1');

      expect(summary.lastPayout).toEqual({ amount: '50', paidAt });
      expect(summary.lastPayoutAmount).toBe('50');
      expect(summary.lastPayoutDate).toBe(paidAt);
    });

    it('returns null lastPayout when the seller has never been paid', async () => {
      vi.mocked(repo.sumForSeller).mockResolvedValue(0);
      vi.mocked(repo.findLastPaidForSeller).mockResolvedValue(null);

      const summary = await service.getSellerSummary('seller-1');

      expect(summary.lastPayout).toBeNull();
      expect(summary.lastPayoutAmount).toBeNull();
      expect(summary.lastPayoutDate).toBeNull();
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
      expect(data[0].grossAmount).toBeNull();
      expect(data[0].commissionRate).toBeNull();
      expect(data[0].commissionAmount).toBeNull();
    });

    it('listForSeller exposes the commission breakdown for brand payouts (amount = gross - commission)', async () => {
      vi.mocked(repo.findForSeller).mockResolvedValue({
        data: [
          buildPayout({
            amount: new Decimal(750),
            grossAmount: new Decimal(1000),
            commissionRate: new Decimal(25),
            commissionAmount: new Decimal(250),
          }),
        ],
        total: 1,
      });

      const { data } = await service.listForSeller('seller-1', {}, { page: 1, limit: 20 });

      expect(data[0]).toMatchObject({ amount: '750', grossAmount: '1000', commissionRate: '25', commissionAmount: '250' });
      expect(Number(data[0].grossAmount) - Number(data[0].commissionAmount)).toBe(Number(data[0].amount));
    });

    it('listForAdmin stringifies the Decimal amount and exposes seller type + brand name', async () => {
      vi.mocked(repo.findForAdmin).mockResolvedValue({
        data: [
          { ...buildPayout(), seller: { businessName: 'Jaipur Handicrafts', sellerType: 'CURATED', brand: null } },
          {
            ...buildPayout({ id: 'payout-2' }),
            seller: { businessName: 'Legal Co', sellerType: 'MARKETPLACE', brand: { name: 'Brand One' } },
          },
        ],
        total: 2,
      } as never);

      const { data } = await service.listForAdmin({}, { page: 1, limit: 20 });

      expect(data[0].amount).toBe('50');
      expect(data[0].seller).toEqual({ businessName: 'Jaipur Handicrafts', sellerType: 'CURATED', brandName: null });
      expect(data[1].seller).toEqual({ businessName: 'Legal Co', sellerType: 'MARKETPLACE', brandName: 'Brand One' });
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
