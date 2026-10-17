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
  QuoteLine,
  QuoteResult,
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
export const ITEMS_UNAVAILABLE = 'ITEMS_UNAVAILABLE';

type CheckoutProduct = Awaited<ReturnType<ProductsService['getForCheckout']>>;

type LinePricing =
  | { ok: true; priced: PricedOrderItem }
  | {
      ok: false;
      kind: 'BELOW_MOQ' | 'OPTION_CHANGED' | 'CHOOSE_OPTION' | 'NO_PRICE' | 'SAMPLE_UNAVAILABLE' | 'ABOVE_SAMPLE_LIMIT';
      message: string;
    };

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

// A buyer may cancel only until the order is confirmed (curated) or accepted by the brand
// (marketplace) — in both cases that is the move out of PAYMENT_RECEIVED.
const BUYER_CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_RECEIVED];

/** A marketplace brand must accept a paid order within this window or it is cancelled. */
export const BRAND_ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    paidAt: order.paidAt,
    dispatchPhotos: (order.dispatchPhotos as string[] | null) ?? [],
    brandOwnBuyer: order.brandOwnBuyer,
    refundedAt: order.refundedAt,
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
      isSample: item.isSample,
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

  /**
   * Loads every cart product and classifies its availability (deleted / unpublished / unapproved /
   * suspended brand / brand product asked for by an agent). Shared by checkout (which throws on any
   * unavailable line) and quote (which reports a per-line status).
   */
  private async loadProductsWithAvailability(
    items: CheckoutItemInput[],
    pricingRole: PricingRole,
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

    const brandIds = [
      ...new Set(loaded.map((l) => l.product?.brandId).filter((id): id is string => !!id)),
    ];
    const brands = brandIds.length > 0 ? await this.repo.findBrandsByIds(brandIds) : [];
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const onVacation = await this.repo.findSellersOnVacation([
      ...new Set(loaded.map((l) => l.product?.sellerId).filter((id): id is string => !!id)),
    ]);

    const result = new Map<string, { product: CheckoutProduct | null; available: boolean }>();
    for (const { id, product } of loaded) {
      const brand = product?.brandId ? brandById.get(product.brandId) : undefined;
      const bad =
        !product ||
        product.deletedAt ||
        !product.isPublished ||
        product.approvalStatus !== 'APPROVED' ||
        // Agents are limited to Solomon-curated products - marketplace brand products are
        // never purchasable by them (owner decision; they cannot even see them).
        (pricingRole === 'AGENT' && !!product.brandId) ||
        (!!product.brandId && (!brand || brand.status === BrandStatus.SUSPENDED)) ||
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
    pricingRole: PricingRole,
  ): Promise<Map<string, CheckoutProduct>> {
    const loaded = await this.loadProductsWithAvailability(items, pricingRole);
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

    // A flat (no-variant) product - curated or brand - can carry its own quantity ladder;
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
        brandId: product.brandId ?? null,
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
   * A brand is paid its own sample price (gross; commission is applied at payment); a curated
   * seller is paid its usual unit cost, since the admin sets the curated sample price.
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
    const sellerUnit = product.brandId ? price : Number(product.sellerPrice);
    return {
      ok: true,
      priced: {
        productId: product.id,
        variantId: item.variantId,
        sellerId: product.sellerId,
        brandId: product.brandId ?? null,
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
    const products = await this.loadAvailableProducts(items, pricingRole);
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
    const loaded = await this.loadProductsWithAvailability(items, pricingRole);
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
      // Samples are exempt: a samples-only order skips the minimum, and sample lines never
      // count toward (or against) the wholesale minimum.
      const wholesale = group.items.filter((i) => !i.isSample);
      if (wholesale.length === 0) continue;
      const required = Number(group.brand.minOrderValueInr);
      const currentPaise = wholesale.reduce((sum, i) => sum + toPaise(i.lineAdminTotal), 0);
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
    const ownBuyerOrderIds: string[] = [];

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
          if (await this.lockCommission(tx, order)) ownBuyerOrderIds.push(id);
          brandOrderIds.push(id);
        }
      }
    });

    // The brand's own buyers are paid out instantly, on payment rather than on dispatch.
    for (const id of ownBuyerOrderIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.payouts.createForDeliveredBrandOrder(id);
      } catch (err) {
        logger.error({ err, orderId: id }, 'Failed to create instant payout for own-buyer order — reconcile manually');
      }
    }

    // After commit: a notification failure must never undo or fail a settled payment.
    for (const id of brandOrderIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await notificationsService.notifyBrandNewOrder(id);
      } catch (err) {
        logger.error({ err, orderId: id }, 'Failed to notify brand of new order');
      }
    }
    // Every newly settled order (brand or curated) alerts the super admins. Replays settle
    // nothing, so this never double-sends.
    for (const id of settledOrderIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await notificationsService.notifyAdminsNewOrder(id);
      } catch (err) {
        logger.error({ err, orderId: id }, 'Failed to notify admins of new order');
      }
    }

    return { settledOrderIds, brandOrderIds };
  }

  /**
   * Locks the commission for one brand order inside the settlement transaction. The brand row is
   * locked BEFORE counting this buyer's other paid orders with the brand so two concurrent first
   * orders from the same buyer serialise: the second one sees the first as paid and gets the repeat rate.
   * The 'first' rate applies once per buyer per brand; every later order from that buyer is 'repeat'.
   * Isolated on purpose — this is the piece that would move if commission is locked at checkout.
   */
  private async lockCommission(tx: DbTx, order: Order): Promise<boolean> {
    const sellerProfileId = order.sellerProfileId!;
    const brand = await this.repo.findBrandBySellerProfileId(tx, sellerProfileId);
    if (!brand) {
      throw AppError.internal(`Brand missing for marketplace order ${order.id}`);
    }

    await this.repo.lockBrand(tx, brand.id);
    // The brand's own buyers (joined via its invite link) carry no commission.
    const ownBuyer = await this.repo.isBrandOwnBuyer(tx, brand.id, order.buyerId);
    const otherPaid = ownBuyer
      ? 0
      : await this.repo.countOtherPaidBrandOrders(tx, sellerProfileId, order.buyerId, order.id);
    const rate = ownBuyer ? 0 : pickRate(await this.rates.resolveCommissionRates(brand.id), otherPaid === 0);

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
      brandOwnBuyer: ownBuyer,
    });
    logger.info({ orderId: order.id, brandId: brand.id, rate, ownBuyer, firstOrder: otherPaid === 0 }, 'Commission locked');
    return ownBuyer;
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

  /** Buyer self-cancel, allowed until the order is confirmed (curated) or accepted (marketplace). */
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

  /**
   * Cancels marketplace orders the brand did not accept within 24h of payment. Run on a
   * timer; each order is moved with a status guard so a brand accepting at the same moment wins.
   */
  async expireUnacceptedBrandOrders(now: Date = new Date()): Promise<string[]> {
    const stale = await this.repo.findUnacceptedBrandOrders(new Date(now.getTime() - BRAND_ACCEPT_WINDOW_MS));
    const expired: string[] = [];
    for (const order of stale) {
      // eslint-disable-next-line no-await-in-loop
      const moved = await this.repo.transitionIfStatus(order.id, OrderStatus.PAYMENT_RECEIVED, OrderStatus.CANCELLED, {
        cancelledReason: 'Not accepted by the brand within 24 hours. A full refund will be issued.',
      });
      if (!moved) continue;
      expired.push(order.id);
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.notifyBuyer(order.buyerId, order.id, OrderStatus.CANCELLED);
      } catch (err) {
        logger.error({ err, orderId: order.id }, 'Failed to notify buyer of expired brand order');
      }
    }
    if (expired.length > 0) {
      logger.info({ orderIds: expired }, 'Cancelled marketplace orders not accepted within 24h');
    }
    return expired;
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
    extra?: { trackingNumber?: string; dispatchPhotos?: string[]; cancelledReason?: string },
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

  /** The brand turns down a paid order it has not accepted; the buyer is refunded. */
  async brandDecline(sellerProfileId: string, orderId: string, reason: string): Promise<BrandOrderView> {
    return this.brandTransition(sellerProfileId, orderId, OrderStatus.PAYMENT_RECEIVED, OrderStatus.CANCELLED, {
      cancelledReason: `Declined by the brand: ${reason}`,
    });
  }

  async brandShip(
    sellerProfileId: string,
    orderId: string,
    trackingNumber: string,
    dispatchPhotos: string[],
    carrier?: string,
  ): Promise<BrandOrderView> {
    if (dispatchPhotos.length === 0) {
      throw AppError.badRequest('Upload at least one dispatch photo before shipping');
    }
    const tracking = carrier ? `${carrier}: ${trackingNumber}` : trackingNumber;
    const view = await this.brandTransition(sellerProfileId, orderId, OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, {
      trackingNumber: tracking,
      dispatchPhotos,
    });
    // Brands are paid on dispatch. The status change is already committed and cannot be retried
    // by the brand, so a payout failure is logged loudly for reconciliation rather than failing.
    try {
      await this.payouts.createForDeliveredBrandOrder(orderId);
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to create payout for dispatched brand order — reconcile manually');
    }
    return view;
  }

  brandDeliver(sellerProfileId: string, orderId: string): Promise<BrandOrderView> {
    return this.brandTransition(sellerProfileId, orderId, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED);
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
