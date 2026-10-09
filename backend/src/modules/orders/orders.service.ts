import { randomUUID } from 'crypto';
import { BrandStatus, Order, OrderStatus } from '@prisma/client';
import { logger } from '../../config/logger';
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
import { computeLineCommission, fromPaise, pickRate, toPaise } from './commission';
import {
  AdminOrderListFilter,
  BrandOrderRecord,
  BrandOrderView,
  BuyerOrder,
  CheckoutBrand,
  CheckoutItemInput,
  CommissionRatesPort,
  DbTx,
  MinOrderViolation,
  OrderWithItems,
  PendingCheckout,
  PricedOrderItem,
  PricingRole,
  SellerOrderItem,
} from './orders.types';

/** Default rates port: lazily resolved so the brands module is only loaded when a brand order settles. */
const brandRatesPort: CommissionRatesPort = {
  async resolveCommissionRates(brandId) {
    const { brandsService } = await import('../brands/brands.service');
    return brandsService.resolveCommissionRates(brandId);
  },
};

export const MIN_ORDER_VALUE_NOT_MET = 'MIN_ORDER_VALUE_NOT_MET';

interface FulfilmentGroup {
  /** Brand's SellerProfile id; null for the curated group. */
  sellerProfileId: string | null;
  brand: CheckoutBrand | null;
  items: PricedOrderItem[];
}

export interface SettleOutcome {
  /** Orders this call actually moved to PAYMENT_RECEIVED (empty when it was a replay). */
  settledOrderIds: string[];
  brandOrderIds: string[];
}

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
    checkoutId: order.checkoutId ?? null,
    brand: order.sellerProfile?.brand
      ? { name: order.sellerProfile.brand.name, slug: order.sellerProfile.brand.slug }
      : null,
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
      variantLabel: item.variant ? `${item.variant.type}: ${item.variant.value}` : null,
      quantity: item.quantity,
      unitAdminPrice: item.unitAdminPrice.toString(),
      lineAdminTotal: item.lineAdminTotal.toString(),
      reviewed: !!item.review,
      brand: item.product.brand
        ? {
            id: item.product.brand.id,
            name: item.product.brand.name,
            slug: item.product.brand.slug,
            logoUrl: item.product.brand.logoUrl,
            isVerified: item.product.brand.isVerified,
            minOrderValueInr: Number(item.product.brand.minOrderValueInr),
          }
        : null,
    })),
  };
}

/** Brand-facing projection of ITS OWN order — includes buyer contact + address needed to ship. */
export function toBrandOrderView(order: BrandOrderRecord): BrandOrderView {
  const paid = order.items.some((i) => i.commissionAmount != null);
  const commissionPaise = order.items.reduce((sum, i) => sum + toPaise(Number(i.commissionAmount ?? 0)), 0);
  const grossPaise = toPaise(Number(order.adminPriceTotal));
  const addr = order.shippingAddress;
  return {
    id: order.id,
    checkoutId: order.checkoutId ?? null,
    status: order.status,
    trackingNumber: order.trackingNumber,
    cancelledReason: order.cancelledReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    grossTotal: order.adminPriceTotal.toString(),
    commissionTotal: paid ? fromPaise(commissionPaise).toFixed(2) : null,
    netTotal: paid ? fromPaise(grossPaise - commissionPaise).toFixed(2) : null,
    buyer: {
      name: order.buyer.contactName,
      company: order.buyer.companyName,
      phone: order.buyer.phone,
      country: order.buyer.country,
    },
    shippingAddress: addr
      ? {
          label: addr.label,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productImage: item.product.images[0]?.url ?? null,
      variantLabel: item.variant ? `${item.variant.type}: ${item.variant.value}` : null,
      quantity: item.quantity,
      unitPrice: item.unitAdminPrice.toString(),
      lineGross: item.lineAdminTotal.toString(),
      commissionRate: item.commissionRate != null ? item.commissionRate.toString() : null,
      commissionAmount: item.commissionAmount != null ? item.commissionAmount.toString() : null,
      lineNet: item.commissionAmount != null ? item.lineSellerTotal.toString() : null,
    })),
  };
}

export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository = ordersRepository,
    private readonly products: ProductsService = productsService,
    private readonly buyers: BuyersService = buyersService,
    private readonly payouts: PayoutsService = payoutsService,
    private readonly rates: CommissionRatesPort = brandRatesPort,
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

        // Marketplace brands set a single price for everyone: an agent pays (and sees)
        // exactly the buyer price for a brand's product. Only curated products have a
        // separate admin-set agent price, so price brand products as a plain buyer.
        const itemRole: PricingRole = product.brandId ? 'BUYER' : pricingRole;

        if (product.deletedAt || !product.isPublished || product.approvalStatus !== 'APPROVED') {
          throw AppError.badRequest(`Product ${item.productId} is not available for purchase`);
        }
        if (item.quantity < product.moq) {
          throw AppError.badRequest(
            `Product "${product.name}" requires a minimum order quantity of ${product.moq}`,
          );
        }

        // Never trust a client-supplied price — always recompute server-side. Variants
        // are priced independently of the flat product price (a Size L isn't the same
        // price as a Size S), so a variantId resolves to that variant's own MOQ-tiered
        // price; only fall back to the flat product mirror when no variant applies.
        let unitAdminPrice: number | null = null;
        let unitSellerPrice: number | null = null;

        if (item.variantId) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (!variant) {
            throw AppError.badRequest(`Variant ${item.variantId} does not belong to product ${item.productId}`);
          }
          const tiers = variant.priceTiers.filter((t) =>
            itemRole === 'AGENT' ? t.agentPrice != null : t.adminPrice != null,
          );
          if (tiers.length > 0) {
            const sorted = [...tiers].sort((a, b) => b.moq - a.moq);
            const applicable = sorted.find((t) => item.quantity >= t.moq) ?? sorted[sorted.length - 1];
            unitAdminPrice = Number(itemRole === 'AGENT' ? applicable.agentPrice : applicable.adminPrice);
            unitSellerPrice = Number(applicable.sellerPrice);
          }
        }

        // A marketplace brand's flat (no-variant) product can carry its own quantity ladder.
        if (unitAdminPrice == null && product.brandId) {
          const tiers = product.priceTiers.filter((t) => t.adminPrice != null);
          if (tiers.length > 0) {
            const sorted = [...tiers].sort((a, b) => b.moq - a.moq);
            const applicable = sorted.find((t) => item.quantity >= t.moq) ?? sorted[sorted.length - 1];
            unitAdminPrice = Number(applicable.adminPrice);
            unitSellerPrice = Number(applicable.sellerPrice);
          }
        }

        if (unitAdminPrice == null) {
          const chargePrice = itemRole === 'AGENT' ? product.agentPrice : product.adminPrice;
          if (!chargePrice) {
            throw AppError.badRequest(
              itemRole === 'AGENT'
                ? `Product ${item.productId} has no agent price set`
                : `Product ${item.productId} has no selling price set`,
            );
          }
          unitAdminPrice = Number(chargePrice);
          unitSellerPrice = Number(product.sellerPrice);
        }

        return {
          productId: product.id,
          variantId: item.variantId,
          sellerId: product.sellerId,
          brandId: product.brandId ?? null,
          quantity: item.quantity,
          unitAdminPrice,
          unitSellerPrice: unitSellerPrice!,
          lineAdminTotal: Math.round(unitAdminPrice * item.quantity * 100) / 100,
          lineSellerTotal: Math.round(unitSellerPrice! * item.quantity * 100) / 100,
        };
      }),
    );
  }

  /** Splits priced items into one group per fulfiller: each active brand, plus at most one curated group. */
  private async groupByFulfiller(items: PricedOrderItem[]): Promise<FulfilmentGroup[]> {
    const brandIds = [...new Set(items.map((i) => i.brandId).filter((id): id is string => !!id))];
    const brands = brandIds.length > 0 ? await this.repo.findBrandsByIds(brandIds) : [];
    const brandById = new Map(brands.map((b) => [b.id, b]));

    const curated: FulfilmentGroup = { sellerProfileId: null, brand: null, items: [] };
    const byBrand = new Map<string, FulfilmentGroup>();

    for (const item of items) {
      if (!item.brandId) {
        curated.items.push(item);
        continue;
      }
      const brand = brandById.get(item.brandId);
      if (!brand || brand.status === BrandStatus.SUSPENDED) {
        throw AppError.badRequest(`Product ${item.productId} is not available for purchase`);
      }
      const group = byBrand.get(brand.id) ?? { sellerProfileId: brand.sellerProfileId, brand, items: [] };
      group.items.push(item);
      byBrand.set(brand.id, group);
    }

    return [...(curated.items.length > 0 ? [curated] : []), ...byBrand.values()];
  }

  /** Server-side minimum order value per brand, on the sum of that brand's lineAdminTotal (INR). */
  private findMinOrderViolations(groups: FulfilmentGroup[]): MinOrderViolation[] {
    const violations: MinOrderViolation[] = [];
    for (const group of groups) {
      if (!group.brand) continue;
      const required = Number(group.brand.minOrderValueInr);
      const currentPaise = group.items.reduce((sum, i) => sum + toPaise(i.lineAdminTotal), 0);
      if (currentPaise < toPaise(required)) {
        violations.push({
          brandId: group.brand.id,
          brandName: group.brand.name,
          required,
          current: fromPaise(currentPaise),
        });
      }
    }
    return violations;
  }

  /**
   * Called by the payments module at the start of checkout. Creates one PENDING_PAYMENT sibling
   * order per brand (plus one for curated items) sharing a checkoutId.
   */
  async createPendingCheckout(
    buyerId: string,
    items: CheckoutItemInput[],
    shippingAddressId: string | undefined,
    pricingRole: PricingRole,
  ): Promise<PendingCheckout> {
    if (shippingAddressId) {
      await this.buyers.verifyAddressOwnership(buyerId, shippingAddressId);
    }

    const pricedItems = await this.priceCheckoutItems(items, pricingRole);
    const groups = await this.groupByFulfiller(pricedItems);

    const violations = this.findMinOrderViolations(groups);
    if (violations.length > 0) {
      throw AppError.unprocessable(
        `Minimum order value not met for: ${violations
          .map((v) => `${v.brandName} (required ${v.required}, current ${v.current})`)
          .join('; ')}`,
        { code: MIN_ORDER_VALUE_NOT_MET, details: violations },
      );
    }

    const checkoutId = randomUUID();
    const orders: OrderWithItems[] = [];
    for (const group of groups) {
      const adminPriceTotal = fromPaise(group.items.reduce((sum, i) => sum + toPaise(i.lineAdminTotal), 0));
      const sellerPriceTotal = fromPaise(group.items.reduce((sum, i) => sum + toPaise(i.lineSellerTotal), 0));
      // eslint-disable-next-line no-await-in-loop
      const order = await this.repo.createPending({
        buyerId,
        shippingAddressId,
        items: group.items,
        adminPriceTotal,
        sellerPriceTotal,
        adminMargin: calculateMargin(adminPriceTotal, sellerPriceTotal),
        placedAsAgent: pricingRole === 'AGENT',
        sellerProfileId: group.sellerProfileId,
        checkoutId,
      });
      orders.push(order);
    }
    return { checkoutId, orders };
  }

  /** Single-order convenience for curated-only carts; checkout uses createPendingCheckout. */
  async createPendingOrder(
    buyerId: string,
    items: CheckoutItemInput[],
    shippingAddressId: string | undefined,
    pricingRole: PricingRole,
  ): Promise<OrderWithItems> {
    const { orders } = await this.createPendingCheckout(buyerId, items, shippingAddressId, pricingRole);
    return orders[0];
  }

  /** Legacy single-order paid transition (curated orders only). Checkout settlement uses markCheckoutPaid. */
  async markPaymentReceived(orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw AppError.badRequest('Order is not awaiting payment');
    }
    if (order.sellerProfileId) {
      throw AppError.badRequest('Marketplace orders are settled together with their checkout');
    }
    return this.repo.setStatus(orderId, OrderStatus.PAYMENT_RECEIVED);
  }

  /**
   * The single settle path, used by both PayPal capture and the PayPal webhook. In ONE DB
   * transaction: run `inTx` (the payments module completes its Payment rows there), flip every
   * still-PENDING_PAYMENT sibling order to PAYMENT_RECEIVED, and lock commission on brand orders.
   * Idempotent: orders already past PENDING_PAYMENT are skipped, so a replay changes nothing.
   */
  async markCheckoutPaid(orderIds: string[], inTx?: (tx: DbTx) => Promise<void>): Promise<SettleOutcome> {
    // Deterministic order avoids deadlocks between concurrent settlements.
    const sortedIds = [...new Set(orderIds)].sort();
    const settledOrderIds: string[] = [];
    const brandOrderIds: string[] = [];

    await this.repo.runInTransaction(async (tx) => {
      if (inTx) await inTx(tx);
      for (const id of sortedIds) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await this.repo.markPaidIfPending(tx, id))) continue;
        settledOrderIds.push(id);
        // eslint-disable-next-line no-await-in-loop
        const order = await this.repo.findOrderInTx(tx, id);
        if (order?.sellerProfileId) {
          // eslint-disable-next-line no-await-in-loop
          await this.lockCommission(tx, order);
          brandOrderIds.push(id);
        }
      }
    });

    // After commit: a notification failure must never undo or fail a settled payment.
    for (const id of brandOrderIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await notificationsService.notifyBrandNewOrder(id);
      } catch (err) {
        logger.error({ err, orderId: id }, 'Failed to notify brand of new order');
      }
    }

    return { settledOrderIds, brandOrderIds };
  }

  /**
   * Locks the commission for one brand order inside the settlement transaction. The brand row is
   * locked BEFORE counting the brand's other paid orders so two concurrent first orders serialise:
   * the second one sees the first as already paid and gets the repeat rate.
   * Isolated on purpose — this is the piece that would move if commission is locked at checkout.
   */
  private async lockCommission(tx: DbTx, order: Order): Promise<void> {
    const sellerProfileId = order.sellerProfileId!;
    const brand = await this.repo.findBrandBySellerProfileId(tx, sellerProfileId);
    if (!brand) {
      throw AppError.internal(`Brand missing for marketplace order ${order.id}`);
    }

    await this.repo.lockBrand(tx, brand.id);
    const otherPaid = await this.repo.countOtherPaidBrandOrders(tx, sellerProfileId, order.id);
    const rate = pickRate(await this.rates.resolveCommissionRates(brand.id), otherPaid === 0);

    const items = await this.repo.findItemsInTx(tx, order.id);
    let netPaise = 0;
    for (const item of items) {
      const c = computeLineCommission(Number(item.lineAdminTotal), item.quantity, rate);
      netPaise += toPaise(c.lineNet);
      // eslint-disable-next-line no-await-in-loop
      await this.repo.updateItemCommission(tx, item.id, {
        commissionRate: rate,
        commissionAmount: c.commissionAmount,
        unitSellerPrice: c.unitNet,
        lineSellerTotal: c.lineNet,
      });
    }
    const adminPaise = toPaise(Number(order.adminPriceTotal));
    await this.repo.updateOrderTotals(tx, order.id, {
      sellerPriceTotal: fromPaise(netPaise),
      adminMargin: fromPaise(adminPaise - netPaise),
    });
    logger.info({ orderId: order.id, brandId: brand.id, rate, firstOrder: otherPaid === 0 }, 'Commission locked');
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
    if (order.sellerProfileId) {
      throw AppError.badRequest('Marketplace orders are fulfilled by the brand, not the admin pipeline');
    }
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

  // -- Marketplace brand fulfilment --------------------------------------

  async listForBrand(
    sellerProfileId: string,
    status: OrderStatus | undefined,
    pagination: PaginationQuery,
  ): Promise<{ data: BrandOrderView[]; total: number }> {
    const { data, total } = await this.repo.listForBrand(sellerProfileId, status, pagination);
    return { data: data.map(toBrandOrderView), total };
  }

  /** Ownership: the order must belong to the caller's brand. Unpaid orders are invisible to the brand. */
  private async getBrandOrderOrThrow(sellerProfileId: string, orderId: string): Promise<BrandOrderRecord> {
    const order = await this.repo.findBrandOrder(orderId);
    if (!order || order.deletedAt || order.status === OrderStatus.PENDING_PAYMENT) {
      throw AppError.notFound('Order not found');
    }
    if (order.sellerProfileId !== sellerProfileId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    return order;
  }

  async getForBrand(sellerProfileId: string, orderId: string): Promise<BrandOrderView> {
    return toBrandOrderView(await this.getBrandOrderOrThrow(sellerProfileId, orderId));
  }

  private async brandTransition(
    sellerProfileId: string,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    extra?: { trackingNumber?: string },
  ): Promise<BrandOrderView> {
    const order = await this.getBrandOrderOrThrow(sellerProfileId, orderId);
    if (order.status !== from) {
      throw AppError.badRequest(`Cannot move an order from ${order.status} to ${to}`);
    }
    if (!(await this.repo.transitionIfStatus(orderId, from, to, extra))) {
      throw AppError.conflict('Order status changed concurrently, please refresh');
    }
    // Brand actors have no admin user id for writeAuditLog, so log via the logger.
    logger.info({ orderId, sellerProfileId, from, to }, 'Brand order status changed');

    const buyerUserId = await this.getBuyerUserId(order.buyerId);
    if (buyerUserId) {
      await notificationsService.notifyOrderStatusChanged(buyerUserId, orderId, to);
    }
    return this.getForBrand(sellerProfileId, orderId);
  }

  brandConfirm(sellerProfileId: string, orderId: string): Promise<BrandOrderView> {
    return this.brandTransition(sellerProfileId, orderId, OrderStatus.PAYMENT_RECEIVED, OrderStatus.CONFIRMED);
  }

  brandShip(
    sellerProfileId: string,
    orderId: string,
    trackingNumber: string,
    carrier?: string,
  ): Promise<BrandOrderView> {
    const tracking = carrier ? `${carrier}: ${trackingNumber}` : trackingNumber;
    return this.brandTransition(sellerProfileId, orderId, OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, {
      trackingNumber: tracking,
    });
  }

  async brandDeliver(sellerProfileId: string, orderId: string): Promise<BrandOrderView> {
    const view = await this.brandTransition(
      sellerProfileId,
      orderId,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
    );
    // The status change is already committed and cannot be retried by the brand, so a payout
    // failure is logged loudly for reconciliation rather than failing the request.
    try {
      await this.payouts.createForDeliveredBrandOrder(orderId);
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to create payout for delivered brand order — reconcile manually');
    }
    return view;
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
