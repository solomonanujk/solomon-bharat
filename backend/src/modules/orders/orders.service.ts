import { Order, OrderStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { calculateMargin } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { PaginationQuery } from '../../utils/pagination';
import { prisma } from '../../config/prisma';
import { ProductsService, productsService } from '../products/products.service';
import { BuyersService, buyersService } from '../buyers/buyers.service';
import { PayoutsService, payoutsService } from '../payouts/payouts.service';
import { notificationsService } from '../notifications/notifications.service';
import { OrdersRepository, ordersRepository } from './orders.repository';
import {
  AdminOrderListFilter,
  BuyerOrder,
  CheckoutItemInput,
  OrderWithItems,
  PricedOrderItem,
  PricingRole,
  SellerOrderItem,
} from './orders.types';

/** Admin-driven lifecycle after payment — strictly sequential, no skipping stages. */
const LIFECYCLE_SEQUENCE: OrderStatus[] = [
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCURING,
  OrderStatus.COLLECTED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
];

// Cancellation is only meaningful "before fulfillment" — once procurement has started
// goods are already committed, so cancellation is blocked from PROCURING onward.
const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PAYMENT_RECEIVED, OrderStatus.CONFIRMED];

function toBuyerOrder(order: OrderWithItems): BuyerOrder {
  return {
    id: order.id,
    status: order.status,
    adminPriceTotal: order.adminPriceTotal.toString(),
    trackingNumber: order.trackingNumber,
    exportDocuments: order.exportDocuments,
    expectedCollectionDate: order.expectedCollectionDate,
    cancelledReason: order.cancelledReason,
    shippingAddressId: order.shippingAddressId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productImage: item.product.images[0]?.url ?? null,
      quantity: item.quantity,
      unitAdminPrice: item.unitAdminPrice.toString(),
      lineAdminTotal: item.lineAdminTotal.toString(),
      reviewed: !!item.review,
    })),
  };
}

export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository = ordersRepository,
    private readonly products: ProductsService = productsService,
    private readonly buyers: BuyersService = buyersService,
    private readonly payouts: PayoutsService = payoutsService,
  ) {}

  private async getOrderOrThrow(orderId: string): Promise<Order> {
    const order = await this.repo.findByIdRaw(orderId);
    if (!order || order.deletedAt) {
      throw AppError.notFound('Order not found');
    }
    return order;
  }

  private async priceCheckoutItems(
    items: CheckoutItemInput[],
    pricingRole: PricingRole,
  ): Promise<PricedOrderItem[]> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.products.getForCheckout(item.productId);

        if (product.deletedAt || !product.isPublished || product.approvalStatus !== 'APPROVED') {
          throw AppError.badRequest(`Product ${item.productId} is not available for purchase`);
        }

        const chargePrice = pricingRole === 'AGENT' ? product.agentPrice : product.adminPrice;
        if (!chargePrice) {
          throw AppError.badRequest(
            pricingRole === 'AGENT'
              ? `Product ${item.productId} has no agent price set`
              : `Product ${item.productId} has no selling price set`,
          );
        }
        if (item.quantity < product.moq) {
          throw AppError.badRequest(
            `Product "${product.name}" requires a minimum order quantity of ${product.moq}`,
          );
        }

        const unitAdminPrice = Number(chargePrice);
        const unitSellerPrice = Number(product.sellerPrice);

        return {
          productId: product.id,
          sellerId: product.sellerId,
          quantity: item.quantity,
          unitAdminPrice,
          unitSellerPrice,
          lineAdminTotal: Math.round(unitAdminPrice * item.quantity * 100) / 100,
          lineSellerTotal: Math.round(unitSellerPrice * item.quantity * 100) / 100,
        };
      }),
    );
  }

  /** Called by the payments module at the start of checkout — order starts PENDING_PAYMENT. */
  async createPendingOrder(
    buyerId: string,
    items: CheckoutItemInput[],
    shippingAddressId: string | undefined,
    pricingRole: PricingRole,
  ): Promise<OrderWithItems> {
    if (shippingAddressId) {
      await this.buyers.verifyAddressOwnership(buyerId, shippingAddressId);
    }

    const pricedItems = await this.priceCheckoutItems(items, pricingRole);
    const adminPriceTotal = pricedItems.reduce((sum, i) => sum + i.lineAdminTotal, 0);
    const sellerPriceTotal = pricedItems.reduce((sum, i) => sum + i.lineSellerTotal, 0);

    return this.repo.createPending({
      buyerId,
      shippingAddressId,
      items: pricedItems,
      adminPriceTotal,
      sellerPriceTotal,
      adminMargin: calculateMargin(adminPriceTotal, sellerPriceTotal),
      placedAsAgent: pricingRole === 'AGENT',
    });
  }

  /** Called by the payments module once PayPal capture succeeds. */
  async markPaymentReceived(orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw AppError.badRequest('Order is not awaiting payment');
    }
    return this.repo.setStatus(orderId, OrderStatus.PAYMENT_RECEIVED);
  }

  private assertOwnedByBuyer(order: Order, buyerId: string): void {
    if (order.buyerId !== buyerId) {
      throw AppError.forbidden('You do not have access to this order');
    }
  }

  async getMyOrder(buyerId: string, orderId: string): Promise<BuyerOrder> {
    const order = await this.repo.findByIdWithItems(orderId);
    if (!order || order.deletedAt) {
      throw AppError.notFound('Order not found');
    }
    this.assertOwnedByBuyer(order, buyerId);
    return toBuyerOrder(order);
  }

  async listMyOrders(buyerId: string, pagination: PaginationQuery) {
    const { data, total } = await this.repo.listForBuyer(buyerId, pagination);
    return { data: data.map(toBuyerOrder), total };
  }

  async listForAdmin(filter: AdminOrderListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.listForAdmin(filter, pagination);
    return {
      data: data.map((order) => ({
        ...order,
        adminPriceTotal: order.adminPriceTotal.toString(),
        sellerPriceTotal: order.sellerPriceTotal.toString(),
        adminMargin: order.adminMargin.toString(),
      })),
      total,
    };
  }

  async getForAdmin(orderId: string) {
    const order = await this.repo.findByIdWithItems(orderId);
    if (!order || order.deletedAt) {
      throw AppError.notFound('Order not found');
    }
    return {
      ...order,
      adminPriceTotal: order.adminPriceTotal.toString(),
      sellerPriceTotal: order.sellerPriceTotal.toString(),
      adminMargin: order.adminMargin.toString(),
    };
  }

  private assertNextInSequence(current: OrderStatus, target: OrderStatus): void {
    const currentIndex = LIFECYCLE_SEQUENCE.indexOf(current);
    const targetIndex = LIFECYCLE_SEQUENCE.indexOf(target);
    if (currentIndex === -1 || targetIndex !== currentIndex + 1) {
      throw AppError.badRequest(`Cannot move an order from ${current} to ${target}`);
    }
  }

  private async getBuyerUserId(buyerProfileId: string): Promise<string | null> {
    const buyer = await prisma.buyerProfile.findUnique({
      where: { id: buyerProfileId },
      select: { userId: true },
    });
    return buyer?.userId ?? null;
  }

  private async transition(
    orderId: string,
    target: OrderStatus,
    adminId: string,
    extra?: { expectedCollectionDate?: Date; trackingNumber?: string },
  ): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    this.assertNextInSequence(order.status, target);

    const updated = await this.repo.setStatus(orderId, target, extra);
    await writeAuditLog(adminId, 'ORDER_STATUS_CHANGED', 'Order', orderId, {
      from: order.status,
      to: target,
    });

    const buyerUserId = await this.getBuyerUserId(order.buyerId);
    if (buyerUserId) {
      await notificationsService.notifyOrderStatusChanged(buyerUserId, orderId, target);
    }

    return updated;
  }

  confirmOrder(orderId: string, adminId: string): Promise<Order> {
    return this.transition(orderId, OrderStatus.CONFIRMED, adminId);
  }

  procureOrder(orderId: string, adminId: string, expectedCollectionDate?: Date): Promise<Order> {
    return this.transition(orderId, OrderStatus.PROCURING, adminId, { expectedCollectionDate });
  }

  async collectOrder(orderId: string, adminId: string): Promise<Order> {
    const order = await this.transition(orderId, OrderStatus.COLLECTED, adminId);
    // Goods are physically taken from the seller at this point — Solomon Bharat now owes
    // them, independent of whether the shipment later reaches the buyer (no returns).
    await this.payouts.createForOrder(orderId);
    return order;
  }

  shipOrder(orderId: string, adminId: string, trackingNumber?: string): Promise<Order> {
    return this.transition(orderId, OrderStatus.IN_TRANSIT, adminId, { trackingNumber });
  }

  deliverOrder(orderId: string, adminId: string): Promise<Order> {
    return this.transition(orderId, OrderStatus.DELIVERED, adminId);
  }

  async cancelOrder(orderId: string, reason: string, adminId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw AppError.badRequest(`An order in ${order.status} can no longer be cancelled`);
    }

    const updated = await this.repo.setStatus(orderId, OrderStatus.CANCELLED, { cancelledReason: reason });
    await writeAuditLog(adminId, 'ORDER_CANCELLED', 'Order', orderId, { reason });

    const buyerUserId = await this.getBuyerUserId(order.buyerId);
    if (buyerUserId) {
      await notificationsService.notifyOrderStatusChanged(buyerUserId, orderId, OrderStatus.CANCELLED);
    }

    return updated;
  }

  async setTrackingNumber(orderId: string, trackingNumber: string): Promise<Order> {
    await this.getOrderOrThrow(orderId);
    return this.repo.setTrackingNumber(orderId, trackingNumber);
  }

  async setExportDocuments(orderId: string, documents: string[]): Promise<Order> {
    await this.getOrderOrThrow(orderId);
    return this.repo.setExportDocuments(orderId, documents);
  }

  async listItemsForSeller(sellerId: string, pagination: PaginationQuery): Promise<{ data: SellerOrderItem[]; total: number }> {
    const { data, total } = await this.repo.listItemsForSeller(sellerId, pagination);
    return {
      data: data.map((item) => ({
        orderId: item.orderId,
        orderItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        sellerPrice: item.unitSellerPrice.toString(),
        lineSellerTotal: item.lineSellerTotal.toString(),
        status: item.order.status,
        expectedCollectionDate: item.order.expectedCollectionDate,
        createdAt: item.createdAt,
      })),
      total,
    };
  }
}

export const ordersService = new OrdersService();
