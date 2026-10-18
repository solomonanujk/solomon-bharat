import { randomUUID } from 'crypto';
import { Order, OrderStatus } from '@prisma/client';
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
import { fromPaise, toPaise } from './money';
import {
  AdminOrderListFilter,
  BuyerOrder,
  CheckoutItemInput,
  DbTx,
  OrderWithItems,
  PendingCheckout,
  PricedOrderItem,
  PricingRole,
  QuoteLine,
  QuoteResult,
  SellerOrderItem,
} from './orders.types';

export const ITEMS_UNAVAILABLE = 'ITEMS_UNAVAILABLE';

type CheckoutProduct = Awaited<ReturnType<ProductsService['getForCheckout']>>;

type LinePricing =
  | { ok: true; priced: PricedOrderItem }
  | {
      ok: false;
      kind: 'BELOW_MOQ' | 'OPTION_CHANGED' | 'CHOOSE_OPTION' | 'NO_PRICE' | 'SAMPLE_UNAVAILABLE' | 'ABOVE_SAMPLE_LIMIT';
      message: string;
    };

export interface SettleOutcome {
  /** Orders this call actually moved to PAYMENT_RECEIVED (empty when it was a replay). */
  settledOrderIds: string[];
}

/**
 * Admin-driven curated lifecycle after payment — strictly sequential, no skipping stages.
 * COLLECTED = goods received at the Jaipur warehouse; QUALITY_CHECKED = inspected, with
 * dispatch photos attached.
 */
const LIFECYCLE_SEQUENCE: OrderStatus[] = [
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCURING,
  OrderStatus.COLLECTED,
  OrderStatus.QUALITY_CHECKED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
];

// Admin cancellation is only meaningful "before fulfillment" — once procurement has started
// goods are already committed, so cancellation is blocked from PROCURING onward.
const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CONFIRMED,
];

// A buyer may cancel only until the order is confirmed (the move out of PAYMENT_RECEIVED).
const BUYER_CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_RECEIVED];

function toBuyerOrder(order: OrderWithItems): BuyerOrder {
  return {
    id: order.id,
    checkoutId: order.checkoutId ?? null,
    status: order.status,
    adminPriceTotal: order.adminPriceTotal.toString(),
    trackingNumber: order.trackingNumber,
    exportDocuments: order.exportDocuments,
    expectedCollectionDate: order.expectedCollectionDate,
    cancelledReason: order.cancelledReason,
    paidAt: order.paidAt,
    dispatchPhotos: (order.dispatchPhotos as string[] | null) ?? [],
    refundedAt: order.refundedAt,
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
      isSample: item.isSample,
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

  /**
   * Loads every cart product and classifies its availability (deleted / unpublished / unapproved /
   * seller on vacation). Shared by checkout (which throws on any
   * unavailable line) and quote (which reports a per-line status).
   */
  private async loadProductsWithAvailability(
    items: CheckoutItemInput[],
  ): Promise<Map<string, { product: CheckoutProduct | null; available: boolean }>> {
    const loaded = await Promise.all(
      items.map(async (item): Promise<{ id: string; product: CheckoutProduct | null }> => {
        try {
          return { id: item.productId, product: await this.products.getForCheckout(item.productId) };
        } catch (err) {
          if (err instanceof AppError && err.statusCode === 404) return { id: item.productId, product: null };
          throw err;
        }
      }),
    );

    const onVacation = await this.repo.findSellersOnVacation([
      ...new Set(loaded.map((l) => l.product?.sellerId).filter((id): id is string => !!id)),
    ]);

    const result = new Map<string, { product: CheckoutProduct | null; available: boolean }>();
    for (const { id, product } of loaded) {
      const bad =
        !product ||
        product.deletedAt ||
        !product.isPublished ||
        product.approvalStatus !== 'APPROVED' ||
        // A seller on vacation is not taking orders.
        onVacation.has(product.sellerId);
      result.set(id, { product, available: !bad });
    }
    return result;
  }

  /**
   * Loads every cart product and validates availability for ALL of them before pricing, so a
   * cart with several unavailable lines reports them together (details.productIds) instead of
   * one per attempt. The message names the first unavailable product, as it always has.
   */
  private async loadAvailableProducts(
    items: CheckoutItemInput[],
  ): Promise<Map<string, CheckoutProduct>> {
    const loaded = await this.loadProductsWithAvailability(items);
    const unavailable: string[] = [];
    const byId = new Map<string, CheckoutProduct>();
    for (const item of items) {
      const entry = loaded.get(item.productId)!;
      if (!entry.available) {
        if (!unavailable.includes(item.productId)) unavailable.push(item.productId);
      } else {
        byId.set(item.productId, entry.product!);
      }
    }

    if (unavailable.length > 0) {
      throw AppError.badRequest(`Product ${unavailable[0]} is not available for purchase`, {
        code: ITEMS_UNAVAILABLE,
        productIds: unavailable,
      });
    }
    return byId;
  }

  /**
   * THE pricing core, shared by checkout and quote so what is displayed can never diverge from
   * what is charged. Pure: reports a failure kind instead of throwing; callers decide how to
   * surface it. Never trusts client prices.
   */
  private resolveLinePrice(
    product: CheckoutProduct,
    item: CheckoutItemInput,
    pricingRole: PricingRole,
  ): LinePricing {
    if (item.isSample) return this.resolveSamplePrice(product, item);
    if (item.quantity < product.moq) {
      return {
        ok: false,
        kind: 'BELOW_MOQ',
        message: `Product "${product.name}" requires a minimum order quantity of ${product.moq}`,
      };
    }

    // Price a tier the way the PDP does: an agent pays agentPrice, falling back to the buyer
    // price when the tier has no agent price. Tiers with no usable price are skipped.
    const chargeOf = (t: { adminPrice: unknown; agentPrice: unknown }): number | null => {
      const raw = pricingRole === 'AGENT' && t.agentPrice != null ? t.agentPrice : t.adminPrice;
      if (raw == null) return null;
      const n = Number(raw);
      return n > 0 ? n : null;
    };
    const pickTier = <T extends { moq: number; adminPrice: unknown; agentPrice: unknown }>(
      tiers: T[],
    ): { unitAdminPrice: number; tier: T } | null => {
      const priced = tiers.filter((t) => chargeOf(t) != null);
      if (priced.length === 0) return null;
      const sorted = [...priced].sort((a, b) => b.moq - a.moq);
      const applicable = sorted.find((t) => item.quantity >= t.moq) ?? sorted[sorted.length - 1];
      return { unitAdminPrice: chargeOf(applicable)!, tier: applicable };
    };

    // Variants are priced independently of the flat product price (a Size L isn't the same
    // price as a Size S), so a variantId resolves to that variant's own MOQ-tiered price.
    const activeVariants = product.variants.filter((v) => v.status === 'ACTIVE');
    let unitAdminPrice: number | null = null;
    let unitSellerPrice: number | null = null;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        return {
          ok: false,
          kind: 'OPTION_CHANGED',
          message: `Variant ${item.variantId} does not belong to product ${item.productId}`,
        };
      }
      if (variant.status !== 'ACTIVE') {
        return { ok: false, kind: 'OPTION_CHANGED', message: 'This option is no longer available' };
      }
      const hit = pickTier(variant.priceTiers);
      if (hit) {
        unitAdminPrice = hit.unitAdminPrice;
        unitSellerPrice = Number(hit.tier.sellerPrice);
      }
    } else if (activeVariants.length > 0) {
      return { ok: false, kind: 'CHOOSE_OPTION', message: `Choose an option for "${product.name}"` };
    }

    // A flat (no-variant) product can carry its own quantity ladder;
    // mirror the PDP: highest tier whose moq <= quantity, else the lowest tier.
    if (unitAdminPrice == null) {
      const hit = pickTier(product.priceTiers);
      if (hit) {
        unitAdminPrice = hit.unitAdminPrice;
        unitSellerPrice = Number(hit.tier.sellerPrice);
      }
    }

    if (unitAdminPrice == null) {
      const raw = pricingRole === 'AGENT' ? (product.agentPrice ?? product.adminPrice) : product.adminPrice;
      if (!raw || Number(raw) <= 0) {
        return {
          ok: false,
          kind: 'NO_PRICE',
          message: `Product ${item.productId} has no selling price set`,
        };
      }
      unitAdminPrice = Number(raw);
      unitSellerPrice = Number(product.sellerPrice);
    }

    const sellerUnit = unitSellerPrice!;
    return {
      ok: true,
      priced: {
        productId: product.id,
        variantId: item.variantId,
        sellerId: product.sellerId,
        quantity: item.quantity,
        unitAdminPrice,
        unitSellerPrice: sellerUnit,
        lineAdminTotal: Math.round(unitAdminPrice * item.quantity * 100) / 100,
        lineSellerTotal: Math.round(sellerUnit * item.quantity * 100) / 100,
      },
    };
  }

  /**
   * A sample line: the product's sample price per unit, no MOQ, at most sampleMaxQty units.
   * The seller is paid its usual unit cost, since the admin sets the sample price.
   */
  private resolveSamplePrice(product: CheckoutProduct, item: CheckoutItemInput): LinePricing {
    const price = product.samplePrice != null ? Number(product.samplePrice) : 0;
    if (!product.offersSamples || !(price > 0)) {
      return { ok: false, kind: 'SAMPLE_UNAVAILABLE', message: `Samples are not available for "${product.name}"` };
    }
    const max = Math.max(1, product.sampleMaxQty ?? 1);
    if (item.quantity > max) {
      return {
        ok: false,
        kind: 'ABOVE_SAMPLE_LIMIT',
        message: `You can order at most ${max} sample unit${max === 1 ? '' : 's'} of "${product.name}"`,
      };
    }
    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant || variant.status !== 'ACTIVE') {
        return { ok: false, kind: 'OPTION_CHANGED', message: 'This option is no longer available' };
      }
    } else if (product.variants.some((v) => v.status === 'ACTIVE')) {
      return { ok: false, kind: 'CHOOSE_OPTION', message: `Choose an option for "${product.name}"` };
    }
    const lineTotal = Math.round(price * item.quantity * 100) / 100;
    const sellerUnit = Number(product.sellerPrice);
    return {
      ok: true,
      priced: {
        productId: product.id,
        variantId: item.variantId,
        sellerId: product.sellerId,
        quantity: item.quantity,
        isSample: true,
        unitAdminPrice: price,
        unitSellerPrice: sellerUnit,
        lineAdminTotal: lineTotal,
        lineSellerTotal: Math.round(sellerUnit * item.quantity * 100) / 100,
      },
    };
  }

  private async priceCheckoutItems(
    items: CheckoutItemInput[],
    pricingRole: PricingRole,
  ): Promise<PricedOrderItem[]> {
    const products = await this.loadAvailableProducts(items);
    return items.map((item) => {
      const result = this.resolveLinePrice(products.get(item.productId)!, item, pricingRole);
      if (!result.ok) throw AppError.badRequest(result.message);
      return result.priced;
    });
  }

  /**
   * Server-quoted prices for a cart (buyer or agent). Always returns a status per line instead
   * of throwing, priced by the exact same core as checkout.
   */
  async quoteItems(items: CheckoutItemInput[], pricingRole: PricingRole): Promise<QuoteResult> {
    const loaded = await this.loadProductsWithAvailability(items);
    const lines: QuoteLine[] = items.map((item) => {
      const entry = loaded.get(item.productId);
      const base = {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        isSample: !!item.isSample,
        moq: item.isSample ? 1 : entry?.product?.moq ?? 1,
      };
      if (!entry || !entry.available || !entry.product) {
        return { ...base, status: 'UNAVAILABLE' as const, message: 'This product is no longer available' };
      }
      const result = this.resolveLinePrice(entry.product, item, pricingRole);
      if (result.ok) {
        return {
          ...base,
          status: 'OK' as const,
          unitPriceInr: result.priced.unitAdminPrice,
          lineTotalInr: result.priced.lineAdminTotal,
        };
      }
      const status = result.kind === 'NO_PRICE' ? 'UNAVAILABLE' : result.kind;
      return { ...base, status, message: result.message };
    });
    const subtotalPaise = lines.reduce((sum, l) => sum + (l.status === 'OK' ? toPaise(l.lineTotalInr!) : 0), 0);
    return { lines, subtotalInr: fromPaise(subtotalPaise) };
  }

  /**
   * Called by the payments module at the start of checkout. Creates one PENDING_PAYMENT order
   * (with a checkoutId, kept so the payment flow can settle "a checkout" of one order).
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
    const checkoutId = randomUUID();
    const adminPriceTotal = fromPaise(pricedItems.reduce((sum, i) => sum + toPaise(i.lineAdminTotal), 0));
    const sellerPriceTotal = fromPaise(pricedItems.reduce((sum, i) => sum + toPaise(i.lineSellerTotal), 0));
    const order = await this.repo.createPending({
      buyerId,
      shippingAddressId,
      items: pricedItems,
      adminPriceTotal,
      sellerPriceTotal,
      adminMargin: calculateMargin(adminPriceTotal, sellerPriceTotal),
      placedAsAgent: pricingRole === 'AGENT',
      checkoutId,
    });
    return { checkoutId, orders: [order] };
  }

  /** Single-order convenience; checkout uses createPendingCheckout. */
  async createPendingOrder(
    buyerId: string,
    items: CheckoutItemInput[],
    shippingAddressId: string | undefined,
    pricingRole: PricingRole,
  ): Promise<OrderWithItems> {
    const { orders } = await this.createPendingCheckout(buyerId, items, shippingAddressId, pricingRole);
    return orders[0];
  }

  /** Legacy single-order paid transition. Checkout settlement uses markCheckoutPaid. */
  async markPaymentReceived(orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw AppError.badRequest('Order is not awaiting payment');
    }
    return this.repo.setStatus(orderId, OrderStatus.PAYMENT_RECEIVED);
  }

  /**
   * The single settle path, used by both PayPal capture and the PayPal webhook. In ONE DB
   * transaction: run `inTx` (the payments module completes its Payment rows there), flip every
   * still-PENDING_PAYMENT order to PAYMENT_RECEIVED.
   * Idempotent: orders already past PENDING_PAYMENT are skipped, so a replay changes nothing.
   */
  async markCheckoutPaid(orderIds: string[], inTx?: (tx: DbTx) => Promise<void>): Promise<SettleOutcome> {
    // Deterministic order avoids deadlocks between concurrent settlements.
    const sortedIds = [...new Set(orderIds)].sort();
    const settledOrderIds: string[] = [];

    await this.repo.runInTransaction(async (tx) => {
      if (inTx) await inTx(tx);
      for (const id of sortedIds) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await this.repo.markPaidIfPending(tx, id))) continue;
        settledOrderIds.push(id);
      }
    });

    // Every newly settled order alerts the super admins. Replays settle
    // nothing, so this never double-sends.
    for (const id of settledOrderIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await notificationsService.notifyAdminsNewOrder(id);
      } catch (err) {
        logger.error({ err, orderId: id }, 'Failed to notify admins of new order');
      }
    }

    return { settledOrderIds };
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
    extra?: { expectedCollectionDate?: Date; trackingNumber?: string; dispatchPhotos?: string[] },
  ): Promise<Order> {
    // Historical marketplace-brand orders (sellerProfileId set, from before the model was
    // removed) are managed through this same admin pipeline.
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

  /** Goods received at the Jaipur warehouse. */
  collectOrder(orderId: string, adminId: string): Promise<Order> {
    return this.transition(orderId, OrderStatus.COLLECTED, adminId);
  }

  /** Inspected at the warehouse; the photos are the evidence any later damage claim is judged against. */
  async qualityCheckOrder(orderId: string, adminId: string, dispatchPhotos: string[]): Promise<Order> {
    if (dispatchPhotos.length === 0) {
      throw AppError.badRequest('Attach at least one dispatch photo');
    }
    return this.transition(orderId, OrderStatus.QUALITY_CHECKED, adminId, { dispatchPhotos });
  }

  async shipOrder(orderId: string, adminId: string, trackingNumber?: string): Promise<Order> {
    const order = await this.transition(orderId, OrderStatus.IN_TRANSIT, adminId, { trackingNumber });
    // Sellers are paid on dispatch.
    await this.payouts.createForOrder(orderId);
    return order;
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
    await this.notifyBuyer(order.buyerId, orderId, OrderStatus.CANCELLED);
    return updated;
  }

  private async notifyBuyer(buyerProfileId: string, orderId: string, status: OrderStatus): Promise<void> {
    const buyerUserId = await this.getBuyerUserId(buyerProfileId);
    if (buyerUserId) {
      await notificationsService.notifyOrderStatusChanged(buyerUserId, orderId, status);
    }
  }

  /** Buyer self-cancel, allowed until the order is confirmed. */
  async buyerCancel(buyerId: string, orderId: string, reason?: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    this.assertOwnedByBuyer(order, buyerId);
    if (!BUYER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw AppError.badRequest('This order has already been confirmed and can no longer be cancelled');
    }
    const cancelledReason = reason?.trim() ? `Cancelled by buyer: ${reason.trim()}` : 'Cancelled by buyer';
    if (!(await this.repo.transitionIfStatus(orderId, order.status, OrderStatus.CANCELLED, { cancelledReason }))) {
      throw AppError.conflict('Order status changed concurrently, please refresh');
    }
    logger.info({ orderId, buyerId, from: order.status }, 'Order cancelled by buyer');
    return this.getOrderOrThrow(orderId);
  }

  /** Records that a cancelled, paid order's money was returned to the buyer. */
  async markRefunded(orderId: string, adminId: string, reference: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.status !== OrderStatus.CANCELLED || !order.paidAt) {
      throw AppError.badRequest('Only a cancelled order that was paid can be marked refunded');
    }
    const updated = await this.repo.setStatus(orderId, OrderStatus.REFUNDED, {
      refundedAt: new Date(),
      refundReference: reference,
    });
    await writeAuditLog(adminId, 'ORDER_REFUNDED', 'Order', orderId, { reference });
    await this.notifyBuyer(order.buyerId, orderId, OrderStatus.REFUNDED);
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
