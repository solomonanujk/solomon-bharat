import { describe, it, expect, beforeEach } from 'vitest';
import { OrderStatus, PayoutStatus, ProductApprovalStatus, Role, SellerApplicationStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { AdminRepository } from './admin.repository';

describe('AdminRepository', () => {
  let db: MockPrismaClient;
  let repo: AdminRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      sellerApplication: mockModel(),
      product: mockModel(),
      order: mockModel(),
      payout: mockModel(),
      buyerProfile: mockModel(),
      sellerProfile: mockModel(),
      orderItem: mockModel(),
      category: mockModel(),
      collection: mockModel(),
      auditLog: mockModel(),
      platformSetting: mockModel(),
      user: mockModel(),
    });
    repo = new AdminRepository(db as never);
  });

  it('countPendingSellerApplications counts PENDING and MORE_INFO_REQUESTED', async () => {
    db.sellerApplication.count.mockResolvedValue(3);
    await repo.countPendingSellerApplications();
    expect(db.sellerApplication.count).toHaveBeenCalledWith({
      where: { status: { in: [SellerApplicationStatus.PENDING, SellerApplicationStatus.MORE_INFO_REQUESTED] } },
    });
  });

  it('countPendingProductReviews counts PENDING and RESUBMITTED, non-deleted', async () => {
    db.product.count.mockResolvedValue(2);
    await repo.countPendingProductReviews();
    expect(db.product.count).toHaveBeenCalledWith({
      where: {
        approvalStatus: { in: [ProductApprovalStatus.PENDING, ProductApprovalStatus.RESUBMITTED] },
        deletedAt: null,
      },
    });
  });

  it('countActiveOrders excludes terminal and pre-payment statuses', async () => {
    db.order.count.mockResolvedValue(5);
    await repo.countActiveOrders();
    const arg = db.order.count.mock.calls[0][0];
    expect(arg.where.status.in).not.toContain(OrderStatus.PENDING_PAYMENT);
    expect(arg.where.status.in).not.toContain(OrderStatus.DELIVERED);
    expect(arg.where.status.in).toContain(OrderStatus.PROCURING);
  });

  it('pendingPayoutsSummary returns 0 amount when nothing is pending', async () => {
    db.payout.count.mockResolvedValue(0);
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: null } });
    await expect(repo.pendingPayoutsSummary()).resolves.toEqual({ count: 0, amount: 0 });
  });

  it('pendingPayoutsSummary combines count and sum for PENDING payouts', async () => {
    db.payout.count.mockResolvedValue(4);
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: 320 } });
    const result = await repo.pendingPayoutsSummary();
    expect(db.payout.count).toHaveBeenCalledWith({ where: { status: PayoutStatus.PENDING } });
    expect(result).toEqual({ count: 4, amount: 320 });
  });

  it('totalGMV sums adminPriceTotal across revenue-counting order statuses', async () => {
    db.order.aggregate.mockResolvedValue({ _sum: { adminPriceTotal: 1000 } });
    await expect(repo.totalGMV()).resolves.toBe(1000);
  });

  it('revenueTotals applies the date range filter when given', async () => {
    db.order.aggregate.mockResolvedValue({ _sum: { adminPriceTotal: 500, adminMargin: 100 } });
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    await repo.revenueTotals({ from, to });
    const arg = db.order.aggregate.mock.calls[0][0];
    expect(arg.where.createdAt).toEqual({ gte: from, lte: to });
  });

  it('revenueTotals omits the date filter entirely when no range is given', async () => {
    db.order.aggregate.mockResolvedValue({ _sum: { adminPriceTotal: 0, adminMargin: 0 } });
    await repo.revenueTotals({});
    const arg = db.order.aggregate.mock.calls[0][0];
    expect(arg.where.createdAt).toBeUndefined();
  });

  it('sellerPayoutsTotal scopes to PAID payouts, filtered by paidAt when a range is given', async () => {
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: 200 } });
    const from = new Date('2026-01-01');
    await repo.sellerPayoutsTotal({ from });
    expect(db.payout.aggregate).toHaveBeenCalledWith({
      where: { status: PayoutStatus.PAID, paidAt: { gte: from } },
      _sum: { amount: true },
    });
  });

  it('sellerPayoutsTotal has no paidAt filter when no range is given', async () => {
    db.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    await repo.sellerPayoutsTotal({});
    expect(db.payout.aggregate).toHaveBeenCalledWith({
      where: { status: PayoutStatus.PAID },
      _sum: { amount: true },
    });
  });

  it('ordersByStatus maps grouped rows into status/count pairs', async () => {
    db.order.groupBy.mockResolvedValue([{ status: OrderStatus.DELIVERED, _count: { _all: 7 } }]);
    const result = await repo.ordersByStatus({});
    expect(result).toEqual([{ status: OrderStatus.DELIVERED, count: 7 }]);
  });

  it('distinctOrderCountForSeller counts distinct orders via groupBy row count', async () => {
    db.orderItem.groupBy.mockResolvedValue([{ orderId: 'o1' }, { orderId: 'o2' }]);
    await expect(repo.distinctOrderCountForSeller('seller-1')).resolves.toBe(2);
  });

  it('topProducts joins groupBy counts with product names', async () => {
    db.orderItem.groupBy.mockResolvedValue([
      { productId: 'p1', _count: { _all: 3 }, _sum: { quantity: 10 } },
    ]);
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Table Runner' }]);
    const result = await repo.topProducts(5);
    expect(result).toEqual([{ productId: 'p1', name: 'Table Runner', ordersCount: 3, unitsSold: 10 }]);
  });

  it('topProducts falls back to "Unknown product" if the product was deleted', async () => {
    db.orderItem.groupBy.mockResolvedValue([{ productId: 'p1', _count: { _all: 1 }, _sum: { quantity: 1 } }]);
    db.product.findMany.mockResolvedValue([]);
    const result = await repo.topProducts(5);
    expect(result[0].name).toBe('Unknown product');
  });

  it('orderItemsForProductIds short-circuits to an empty array without querying', async () => {
    await expect(repo.orderItemsForProductIds([])).resolves.toEqual([]);
    expect(db.orderItem.findMany).not.toHaveBeenCalled();
  });

  it('findAuditLog applies entityType and adminId filters together', async () => {
    db.auditLog.findMany.mockResolvedValue([]);
    db.auditLog.count.mockResolvedValue(0);
    await repo.findAuditLog({ entityType: 'Product', adminId: 'admin-1' }, { page: 1, limit: 20 });
    const arg = db.auditLog.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ entityType: 'Product', adminId: 'admin-1' });
  });

  it('upsertSetting creates when missing, updates when present', async () => {
    db.platformSetting.upsert.mockResolvedValue({ key: 'k', value: 'v' });
    await repo.upsertSetting('k', 'v');
    expect(db.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'k' },
      update: { value: 'v' },
      create: { key: 'k', value: 'v' },
    });
  });

  it('findUsers applies an optional role filter', async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(0);
    await repo.findUsers({ role: Role.SELLER }, { page: 1, limit: 20 });
    const arg = db.user.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ role: Role.SELLER });
  });

  it('setUserStatus updates the status field', async () => {
    db.user.update.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' });
    await repo.setUserStatus('u1', 'SUSPENDED');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { status: 'SUSPENDED' } });
  });

  it('promoteToAdmin sets role to SUPER_ADMIN', async () => {
    db.user.update.mockResolvedValue({ id: 'u1', role: Role.SUPER_ADMIN });
    await repo.promoteToAdmin('u1');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: Role.SUPER_ADMIN } });
  });
});
