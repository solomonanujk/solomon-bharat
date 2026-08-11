import { describe, it, expect, beforeEach } from 'vitest';
import { PayoutStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { PayoutsRepository } from './payouts.repository';

describe('PayoutsRepository', () => {
  let db: MockPrismaClient;
  let repo: PayoutsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ payout: mockModel(), orderItem: mockModel() });
    repo = new PayoutsRepository(db as never);
  });

  it('existsForOrder reflects whether any payout exists for the order', async () => {
    db.payout.count.mockResolvedValue(2);
    await expect(repo.existsForOrder('order-1')).resolves.toBe(true);
  });

  it('createManyForOrder does nothing when the order has no items', async () => {
    db.orderItem.findMany.mockResolvedValue([]);
    await repo.createManyForOrder('order-1');
    expect(db.payout.createMany).not.toHaveBeenCalled();
  });

  it('createManyForOrder creates one PENDING payout per order item, owed to each item\'s seller', async () => {
    db.orderItem.findMany.mockResolvedValue([
      { id: 'item-1', sellerId: 'seller-1', lineSellerTotal: 80 },
      { id: 'item-2', sellerId: 'seller-2', lineSellerTotal: 40 },
    ]);
    await repo.createManyForOrder('order-1');
    expect(db.payout.createMany).toHaveBeenCalledWith({
      data: [
        { sellerId: 'seller-1', orderId: 'order-1', orderItemId: 'item-1', amount: 80, status: PayoutStatus.PENDING },
        { sellerId: 'seller-2', orderId: 'order-1', orderItemId: 'item-2', amount: 40, status: PayoutStatus.PENDING },
      ],
    });
  });

  it('markPaid stamps paidAt and sets status PAID, including notes when given', async () => {
    db.payout.update.mockResolvedValue({ id: 'p1' });
    await repo.markPaid('p1', 'Paid via NEFT');
    expect(db.payout.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: PayoutStatus.PAID, paidAt: expect.any(Date), notes: 'Paid via NEFT' },
    });
  });

  it('markPaid omits notes when none given', async () => {
    db.payout.update.mockResolvedValue({ id: 'p1' });
    await repo.markPaid('p1', undefined);
    const arg = db.payout.update.mock.calls[0][0];
    expect(arg.data.notes).toBeUndefined();
  });

  it('findForSeller applies an optional status filter', async () => {
    db.payout.findMany.mockResolvedValue([]);
    db.payout.count.mockResolvedValue(0);
    await repo.findForSeller('seller-1', { status: PayoutStatus.PENDING }, { page: 1, limit: 20 });
    const arg = db.payout.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ sellerId: 'seller-1', status: PayoutStatus.PENDING });
  });

  it('findForAdmin includes the seller business name', async () => {
    db.payout.findMany.mockResolvedValue([]);
    db.payout.count.mockResolvedValue(0);
    await repo.findForAdmin({}, { page: 1, limit: 20 });
    const arg = db.payout.findMany.mock.calls[0][0];
    expect(arg.include.seller).toEqual({ select: { businessName: true } });
  });

  it('sumForSeller returns 0 when there is nothing to sum', async () => {
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: null } });
    await expect(repo.sumForSeller('seller-1', PayoutStatus.PENDING)).resolves.toBe(0);
  });

  it('sumForSeller sums amounts scoped to the seller and status', async () => {
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: 250 } });
    const result = await repo.sumForSeller('seller-1', PayoutStatus.PAID);
    expect(db.payout.aggregate).toHaveBeenCalledWith({
      where: { sellerId: 'seller-1', status: PayoutStatus.PAID },
      _sum: { amount: true },
    });
    expect(result).toBe(250);
  });

  it('findLastPaidForSeller finds the most recently paid payout', async () => {
    db.payout.findFirst.mockResolvedValue({ id: 'p1' });
    await repo.findLastPaidForSeller('seller-1');
    expect(db.payout.findFirst).toHaveBeenCalledWith({
      where: { sellerId: 'seller-1', status: PayoutStatus.PAID },
      orderBy: { paidAt: 'desc' },
    });
  });
});
