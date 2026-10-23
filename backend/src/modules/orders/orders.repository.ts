import { Order, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import {
  AdminOrderListFilter,
  CreatePendingOrderInput,
  DbTx,
  OrderWithItems,
} from './orders.types';

const ITEMS_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          name: true,
          images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
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
        checkoutId: input.checkoutId ?? null,
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
            isSample: item.isSample ?? false,
          })),
        },
      },
      include: ITEMS_INCLUDE,
    });
  }

  setStatus(
    id: string,
    status: OrderStatus,
    extra?: Pick<
      Prisma.OrderUpdateInput,
      'expectedCollectionDate' | 'trackingNumber' | 'cancelledReason' | 'dispatchPhotos' | 'refundedAt' | 'refundReference'
    >,
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
    // Awaiting-payment orders are listed too: with manual (bank transfer) payment the buyer
    // needs to see them, and can cancel them.
    const where = { buyerId, deletedAt: null };
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

  // -- Settlement (all take the transaction client so they join one DB transaction) --

  runInTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }

  /** Atomically PENDING_PAYMENT -> PAYMENT_RECEIVED; returns false when someone else already did it. */
  async markPaidIfPending(tx: DbTx, orderId: string): Promise<boolean> {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT, deletedAt: null },
      data: { status: OrderStatus.PAYMENT_RECEIVED, paidAt: new Date() },
    });
    return count === 1;
  }

  /** Everything the export documents need for one order. */
  findForDocuments(orderId: string) {
    return this.db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, tariffCode: true, weight: true, dimensions: true, placeOfOrigin: true, privateSupplier: { select: { name: true } } } },
            variant: {
              select: {
                sku: true, weight: true, weightUnit: true, length: true, width: true, height: true,
                dimensionUnit: true, tariffCode: true,
              },
            },
          },
        },
        buyer: { select: { companyName: true, contactName: true, phone: true, country: true } },
        shippingAddress: true,
      },
    });
  }

  /** Of the given seller profiles, the ones currently on vacation (not taking orders). */
  async findSellersOnVacation(sellerIds: string[]): Promise<Set<string>> {
    if (sellerIds.length === 0) return new Set();
    const rows = await this.db.sellerProfile.findMany({
      where: { id: { in: sellerIds }, isOnVacation: true },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /** Compare-and-set status change; returns false when the order was no longer in `from`. */
  async transitionIfStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    extra?: Pick<Prisma.OrderUpdateManyMutationInput, 'trackingNumber' | 'dispatchPhotos' | 'cancelledReason'>,
  ): Promise<boolean> {
    const { count } = await this.db.order.updateMany({
      where: { id, status: from, deletedAt: null },
      data: { status: to, ...extra },
    });
    return count === 1;
  }

  async listItemsForSeller(sellerId: string, pagination: PaginationQuery) {
    // Includes historical marketplace-brand orders of sellers converted to curated (Oct 2026).
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
