import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', () => {
  let db: MockPrismaClient;
  let repo: OrdersRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ order: mockModel(), orderItem: mockModel(), brand: mockModel() });
    repo = new OrdersRepository(db as never);
  });

  it('findByIdWithItems includes line items with their product name and thumbnail', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o1' });
    await repo.findByIdWithItems('o1');
    expect(db.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'o1' },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                brand: {
                  select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true, minOrderValueInr: true },
                },
              },
            },
            variant: { select: { type: true, value: true } },
            review: { select: { id: true } },
          },
        },
        sellerProfile: { select: { brand: { select: { name: true, slug: true } } } },
      },
    });
  });

  it('createPending builds nested item creates and starts in PENDING_PAYMENT', async () => {
    db.order.create.mockResolvedValue({ id: 'o1' });
    await repo.createPending({
      buyerId: 'buyer-1',
      shippingAddressId: 'addr-1',
      adminPriceTotal: 100,
      sellerPriceTotal: 80,
      adminMargin: 20,
      placedAsAgent: false,
      items: [
        {
          productId: 'p1',
          sellerId: 's1',
          brandId: null,
          quantity: 2,
          unitAdminPrice: 50,
          unitSellerPrice: 40,
          lineAdminTotal: 100,
          lineSellerTotal: 80,
        },
      ],
    });

    const arg = db.order.create.mock.calls[0][0];
    expect(arg.data.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(arg.data.items.create).toEqual([
      {
        productId: 'p1',
        sellerId: 's1',
        quantity: 2,
        unitAdminPrice: 50,
        unitSellerPrice: 40,
        lineAdminTotal: 100,
        lineSellerTotal: 80,
      },
    ]);
  });

  it('setStatus merges optional extra fields into the update', async () => {
    db.order.update.mockResolvedValue({ id: 'o1' });
    await repo.setStatus('o1', OrderStatus.CANCELLED, { cancelledReason: 'Buyer requested' });
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: OrderStatus.CANCELLED, cancelledReason: 'Buyer requested' },
    });
  });

  it('setTrackingNumber updates only the tracking field', async () => {
    db.order.update.mockResolvedValue({ id: 'o1' });
    await repo.setTrackingNumber('o1', 'TRACK123');
    expect(db.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { trackingNumber: 'TRACK123' } });
  });

  it('listForBuyer excludes still-unpaid orders', async () => {
    db.order.findMany.mockResolvedValue([]);
    db.order.count.mockResolvedValue(0);
    await repo.listForBuyer('buyer-1', { page: 1, limit: 20 });
    const arg = db.order.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      buyerId: 'buyer-1',
      deletedAt: null,
      status: { not: OrderStatus.PENDING_PAYMENT },
    });
  });

  it('listForAdmin applies status and buyerId filters when given', async () => {
    db.order.findMany.mockResolvedValue([]);
    db.order.count.mockResolvedValue(0);
    await repo.listForAdmin({ status: OrderStatus.IN_TRANSIT, buyerId: 'buyer-1' }, { page: 1, limit: 20 });
    const arg = db.order.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: null, status: OrderStatus.IN_TRANSIT, buyerId: 'buyer-1' });
  });

  it('listItemsForSeller scopes to the seller and includes order + product name only (no buyer info)', async () => {
    db.orderItem.findMany.mockResolvedValue([]);
    db.orderItem.count.mockResolvedValue(0);
    await repo.listItemsForSeller('seller-1', { page: 1, limit: 20 });
    const arg = db.orderItem.findMany.mock.calls[0][0];
    // Brand orders are excluded: the curated projection must never expose them.
    expect(arg.where).toEqual({ sellerId: 'seller-1', order: { sellerProfileId: null } });
    expect(arg.include.product).toEqual({ select: { name: true } });
  });

  it('createPending stores sellerProfileId and checkoutId for sibling orders', async () => {
    db.order.create.mockResolvedValue({ id: 'o1' });
    await repo.createPending({
      buyerId: 'b1',
      adminPriceTotal: 1,
      sellerPriceTotal: 1,
      adminMargin: 0,
      placedAsAgent: false,
      items: [],
      sellerProfileId: 'sp-a',
      checkoutId: 'co-1',
    });
    const data = db.order.create.mock.calls[0][0].data;
    expect(data.sellerProfileId).toBe('sp-a');
    expect(data.checkoutId).toBe('co-1');
  });

  it('markPaidIfPending is a compare-and-set on PENDING_PAYMENT', async () => {
    db.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await repo.markPaidIfPending(db as never, 'o1')).toBe(true);
    expect(await repo.markPaidIfPending(db as never, 'o1')).toBe(false);
    expect(db.order.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'o1', status: OrderStatus.PENDING_PAYMENT, deletedAt: null },
      data: { status: OrderStatus.PAYMENT_RECEIVED },
    });
  });

  it('countOtherPaidBrandOrders excludes this order, unpaid and cancelled orders', async () => {
    db.order.count.mockResolvedValue(2);
    expect(await repo.countOtherPaidBrandOrders(db as never, 'sp-a', 'o1')).toBe(2);
    expect(db.order.count).toHaveBeenCalledWith({
      where: {
        sellerProfileId: 'sp-a',
        id: { not: 'o1' },
        status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] },
      },
    });
  });

  it('lockBrand issues SELECT ... FOR UPDATE on the brand row', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    await repo.lockBrand({ $queryRaw: queryRaw } as never, 'brand-a');
    const [strings, id] = queryRaw.mock.calls[0];
    expect((strings as string[]).join('?')).toContain('FOR UPDATE');
    expect((strings as string[]).join('?')).toContain('"brands"');
    expect(id).toBe('brand-a');
  });

  it('runInTransaction delegates to $transaction', async () => {
    const result = await repo.runInTransaction(async () => 'done');
    expect(result).toBe('done');
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('transitionIfStatus only updates when the order is still in the expected status', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await repo.transitionIfStatus('o1', OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, { trackingNumber: 'T' })).toBe(false);
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: OrderStatus.CONFIRMED, deletedAt: null },
      data: { status: OrderStatus.IN_TRANSIT, trackingNumber: 'T' },
    });
  });

  it('listForBrand scopes to the brand, hides unpaid orders by default and loads buyer + address', async () => {
    db.order.findMany.mockResolvedValue([]);
    db.order.count.mockResolvedValue(0);
    await repo.listForBrand('sp-a', undefined, { page: 1, limit: 20 });
    const arg = db.order.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ sellerProfileId: 'sp-a', deletedAt: null, status: { not: OrderStatus.PENDING_PAYMENT } });
    expect(arg.include.shippingAddress).toBe(true);
    expect(arg.include.buyer.select).toEqual({ contactName: true, phone: true, companyName: true, country: true });

    await repo.listForBrand('sp-a', OrderStatus.CONFIRMED, { page: 1, limit: 20 });
    expect(db.order.findMany.mock.calls[1][0].where.status).toBe(OrderStatus.CONFIRMED);
  });

  it('findBrandsByIds selects only what checkout needs', async () => {
    db.brand.findMany.mockResolvedValue([]);
    await repo.findBrandsByIds(['b1']);
    expect(db.brand.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['b1'] } });
  });
});
