import { Order, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { AdminOrderListFilter, CreatePendingOrderInput, OrderWithItems } from './orders.types';

const ITEMS_INCLUDE = {
  items: {
    include: {
      product: { select: { name: true, images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } },
      variant: { select: { type: true, value: true } },
      review: { select: { id: true } },
    },
  },
};

export class OrdersRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findByIdWithItems(id: string): Promise<OrderWithItems | null> {
    return this.db.order.findUnique({ where: { id }, include: ITEMS_INCLUDE });
  }

  findByIdRaw(id: string): Promise<Order | null> {
    return this.db.order.findUnique({ where: { id } });
  }

  createPending(input: CreatePendingOrderInput): Promise<OrderWithItems> {
    return this.db.order.create({
      data: {
        buyerId: input.buyerId,
        shippingAddressId: input.shippingAddressId,
        status: OrderStatus.PENDING_PAYMENT,
        adminPriceTotal: input.adminPriceTotal,
        sellerPriceTotal: input.sellerPriceTotal,
        adminMargin: input.adminMargin,
        placedAsAgent: input.placedAsAgent,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            unitAdminPrice: item.unitAdminPrice,
            unitSellerPrice: item.unitSellerPrice,
            lineAdminTotal: item.lineAdminTotal,
            lineSellerTotal: item.lineSellerTotal,
          })),
        },
      },
      include: ITEMS_INCLUDE,
    });
  }

  setStatus(
    id: string,
    status: OrderStatus,
    extra?: Pick<Prisma.OrderUpdateInput, 'expectedCollectionDate' | 'trackingNumber' | 'cancelledReason'>,
  ): Promise<Order> {
    return this.db.order.update({ where: { id }, data: { status, ...extra } });
  }

  setTrackingNumber(id: string, trackingNumber: string): Promise<Order> {
    return this.db.order.update({ where: { id }, data: { trackingNumber } });
  }

  setExportDocuments(id: string, documents: string[]): Promise<Order> {
    return this.db.order.update({ where: { id }, data: { exportDocuments: documents } });
  }

  async listForBuyer(
    buyerId: string,
    pagination: PaginationQuery,
  ): Promise<{ data: OrderWithItems[]; total: number }> {
    const where = { buyerId, deletedAt: null, status: { not: OrderStatus.PENDING_PAYMENT } };
    const [data, total] = await Promise.all([
      this.db.order.findMany({
        where,
        include: ITEMS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.order.count({ where }),
    ]);
    return { data, total };
  }

  async listForAdmin(
    filter: AdminOrderListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: OrderWithItems[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.buyerId ? { buyerId: filter.buyerId } : {}),
      ...(filter.placedAsAgent !== undefined ? { placedAsAgent: filter.placedAsAgent } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.order.findMany({
        where,
        include: ITEMS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.order.count({ where }),
    ]);
    return { data, total };
  }

  async listItemsForSeller(sellerId: string, pagination: PaginationQuery) {
    const where = { sellerId };
    const [data, total] = await Promise.all([
      this.db.orderItem.findMany({
        where,
        include: { order: true, product: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.orderItem.count({ where }),
    ]);
    return { data, total };
  }
}

export const ordersRepository = new OrdersRepository();
