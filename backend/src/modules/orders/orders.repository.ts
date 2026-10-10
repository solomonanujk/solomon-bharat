import { Brand, Order, OrderItem, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import {
  AdminOrderListFilter,
  BrandOrderRecord,
  CheckoutBrand,
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
};

const BRAND_ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { name: true, images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } },
      variant: { select: { type: true, value: true } },
    },
  },
  buyer: { select: { contactName: true, phone: true, companyName: true, country: true } },
  shippingAddress: true,
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
        sellerProfileId: input.sellerProfileId ?? null,
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

  // -- Checkout helpers --------------------------------------------------

  findBrandsByIds(ids: string[]): Promise<CheckoutBrand[]> {
    return this.db.brand.findMany({
      where: { id: { in: ids } },
      select: { id: true, sellerProfileId: true, name: true, status: true, minOrderValueInr: true },
    });
  }

  // -- Settlement (all take the transaction client so they join one DB transaction) --

  runInTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }

  /** Atomically PENDING_PAYMENT -> PAYMENT_RECEIVED; returns false when someone else already did it. */
  async markPaidIfPending(tx: DbTx, orderId: string): Promise<boolean> {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT, deletedAt: null },
      data: { status: OrderStatus.PAYMENT_RECEIVED },
    });
    return count === 1;
  }

  findOrderInTx(tx: DbTx, orderId: string): Promise<Order | null> {
    return tx.order.findUnique({ where: { id: orderId } });
  }

  findBrandBySellerProfileId(tx: DbTx, sellerProfileId: string): Promise<Brand | null> {
    return tx.brand.findUnique({ where: { sellerProfileId } });
  }

  /** Row-level lock on the brand: serialises concurrent settlements of the same brand's orders. */
  async lockBrand(tx: DbTx, brandId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "brands" WHERE id = ${brandId} FOR UPDATE`;
  }

  /** Other orders of this brand that are past PENDING_PAYMENT and not CANCELLED. */
  countOtherPaidBrandOrders(tx: DbTx, sellerProfileId: string, excludeOrderId: string): Promise<number> {
    return tx.order.count({
      where: {
        sellerProfileId,
        id: { not: excludeOrderId },
        status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] },
      },
    });
  }

  findItemsInTx(tx: DbTx, orderId: string): Promise<OrderItem[]> {
    return tx.orderItem.findMany({ where: { orderId } });
  }

  updateItemCommission(
    tx: DbTx,
    itemId: string,
    data: { commissionRate: number; commissionAmount: number; unitSellerPrice: number; lineSellerTotal: number },
  ): Promise<OrderItem> {
    return tx.orderItem.update({ where: { id: itemId }, data });
  }

  updateOrderTotals(
    tx: DbTx,
    orderId: string,
    data: { sellerPriceTotal: number; adminMargin: number },
  ): Promise<Order> {
    return tx.order.update({ where: { id: orderId }, data });
  }

  // -- Brand fulfilment --------------------------------------------------

  /** Compare-and-set status change; returns false when the order was no longer in `from`. */
  async transitionIfStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    extra?: Pick<Prisma.OrderUpdateManyMutationInput, 'trackingNumber'>,
  ): Promise<boolean> {
    const { count } = await this.db.order.updateMany({
      where: { id, status: from, deletedAt: null },
      data: { status: to, ...extra },
    });
    return count === 1;
  }

  findBrandOrder(id: string): Promise<BrandOrderRecord | null> {
    return this.db.order.findUnique({ where: { id }, include: BRAND_ORDER_INCLUDE });
  }

  async listForBrand(
    sellerProfileId: string,
    status: OrderStatus | undefined,
    pagination: PaginationQuery,
  ): Promise<{ data: BrandOrderRecord[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      sellerProfileId,
      deletedAt: null,
      status: status ?? { not: OrderStatus.PENDING_PAYMENT },
    };
    const [data, total] = await Promise.all([
      this.db.order.findMany({
        where,
        include: BRAND_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.order.count({ where }),
    ]);
    return { data, total };
  }

  async listItemsForSeller(sellerId: string, pagination: PaginationQuery) {
    // Brand orders are fulfilled via the brand endpoints (which expose buyer info); the curated
    // projection must never include them.
    const where = { sellerId, order: { sellerProfileId: null } };
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
