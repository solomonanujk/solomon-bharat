import { describe, it, expect, beforeEach } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', () => {
  let db: MockPrismaClient;
  let repo: OrdersRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ order: mockModel(), orderItem: mockModel() });
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
            product: { select: { name: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
          },
        },
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
      items: [
        {
          productId: 'p1',
          sellerId: 's1',
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
    expect(arg.where).toEqual({ sellerId: 'seller-1' });
    expect(arg.include.product).toEqual({ select: { name: true } });
  });
});
