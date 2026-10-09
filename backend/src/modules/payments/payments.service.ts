import { Payment, PaymentStatus, Prisma, Role } from '@prisma/client';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';
import { paymentProvider, WebhookHeaders } from '../../providers/payments';
import { fxProvider } from '../../providers/fx';
import { prisma } from '../../config/prisma';
import { OrdersService, ordersService } from '../orders/orders.service';
import { PricingRole } from '../orders/orders.types';
import { fromPaise, splitProRata, toPaise } from '../orders/commission';
import { PaymentsRepository, paymentsRepository } from './payments.repository';
import {
  CaptureResult,
  CheckoutInput,
  CheckoutResult,
  FxRateResult,
  Invoice,
  PayPalWebhookEvent,
} from './payments.types';

const SOLOMON_LEGAL_NAME = 'Solomon Bharat Private Limited';

/** Converts an INR amount to `currency` using the platform's own cached FX rate — never trust a client-supplied rate. */
async function convertFromInr(amountInr: number, currency: string): Promise<{ amount: number; rate: number }> {
  if (currency === 'INR') {
    return { amount: amountInr, rate: 1 };
  }
  const { rates } = await fxProvider.getRatesFromInr();
  const rate = rates[currency];
  if (!rate) {
    throw AppError.badRequest(`Unsupported currency: ${currency}`);
  }
  return { amount: Math.round(amountInr * rate * 100) / 100, rate };
}

export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository = paymentsRepository,
    private readonly orders: OrdersService = ordersService,
  ) {}

  async checkout(buyerId: string, input: CheckoutInput, pricingRole: PricingRole): Promise<CheckoutResult> {
    const { checkoutId, orders } = await this.orders.createPendingCheckout(
      buyerId,
      input.items,
      input.shippingAddressId,
      pricingRole,
    );

    const totalInr = fromPaise(orders.reduce((sum, o) => sum + toPaise(Number(o.adminPriceTotal)), 0));
    const { amount: chargeAmount } = await convertFromInr(totalInr, input.currency);

    const providerOrder = await paymentProvider.createOrder({
      amount: chargeAmount,
      currency: input.currency,
      referenceId: checkoutId,
    });

    // One Payment row per sibling order, converted total split pro-rata; the rounding remainder
    // lands on the last row so the rows sum exactly to what PayPal will charge.
    const shares = splitProRata(
      chargeAmount,
      orders.map((o) => Number(o.adminPriceTotal)),
    );
    const payments: Payment[] = [];
    for (let i = 0; i < orders.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      payments.push(
        await this.repo.create(
          orders[i].id,
          shares[i],
          input.currency,
          { createOrderId: providerOrder.providerOrderId },
          checkoutId,
        ),
      );
    }

    return {
      orderId: orders[0].id,
      paymentId: payments[0].id,
      checkoutId,
      orders: orders.map((o) => ({ orderId: o.id, sellerProfileId: o.sellerProfileId ?? null })),
      approveUrl: providerOrder.approveUrl,
      adminPriceTotal: totalInr.toFixed(2),
      currency: input.currency,
      chargeAmount: chargeAmount.toFixed(2),
    };
  }

  async getFxRate(currency: string): Promise<FxRateResult> {
    const { base, rates, date } = await fxProvider.getRatesFromInr();
    const rate = rates[currency];
    if (!rate) {
      throw AppError.badRequest(`Unsupported currency: ${currency}`);
    }
    return { base, currency, rate, date };
  }

  /** Every Payment row of the same checkout (legacy rows without a checkoutId settle alone). */
  private async getCheckoutPayments(payment: Payment): Promise<Payment[]> {
    if (!payment.checkoutId) return [payment];
    const rows = await this.repo.findByCheckoutId(payment.checkoutId);
    return rows.length > 0 ? rows : [payment];
  }

  /**
   * The single settle function shared by capture and the PayPal webhook. Completes the Payment
   * rows and moves every sibling order to PAYMENT_RECEIVED (locking brand commission) in one DB
   * transaction. Idempotent: a replay finds nothing left to change.
   */
  private async settle(payments: Payment[], providerPaymentId: string, raw: unknown): Promise<void> {
    await this.orders.markCheckoutPaid(
      payments.map((p) => p.orderId),
      async (tx) => {
        await this.repo.completeInTx(
          tx,
          payments.map((p) => p.id),
          providerPaymentId,
          raw as Prisma.InputJsonValue,
        );
      },
    );
  }

  private providerOrderIdOf(payment: Payment): string {
    const providerOrderId = (payment.rawPayload as { createOrderId?: string } | null)?.createOrderId;
    if (!providerOrderId) {
      throw AppError.internal('Payment is missing its provider order reference');
    }
    return providerOrderId;
  }

  async capture(buyerId: string, paymentId: string): Promise<CaptureResult> {
    const payment = await this.repo.findByIdWithOrder(paymentId);
    if (!payment) {
      throw AppError.notFound('Payment not found');
    }
    if (payment.order.buyerId !== buyerId) {
      throw AppError.forbidden('You do not have access to this payment');
    }

    const group = await this.getCheckoutPayments(payment);

    // Idempotent: the webhook (or an earlier capture call) may already have settled this checkout.
    if (group.every((p) => p.status === PaymentStatus.COMPLETED)) {
      return { payment, orderId: payment.orderId, status: PaymentStatus.COMPLETED };
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw AppError.badRequest(`Payment is already ${payment.status.toLowerCase()}`);
    }

    const providerOrderId = this.providerOrderIdOf(payment);
    const result = await paymentProvider.captureOrder(providerOrderId);

    if (result.status === 'COMPLETED') {
      await this.settle(group, result.providerPaymentId ?? providerOrderId, result.raw);
      const updated = (await this.repo.findById(paymentId)) ?? payment;
      return { payment: updated, orderId: payment.orderId, status: PaymentStatus.COMPLETED };
    }

    await this.repo.setManyFailed(
      group.map((p) => p.id),
      result.raw as Prisma.InputJsonValue,
    );
    const updated = (await this.repo.findById(paymentId)) ?? payment;
    return { payment: updated, orderId: payment.orderId, status: PaymentStatus.FAILED };
  }

  /**
   * PayPal webhook (public; the route hands us the RAW body for signature verification).
   * Only PAYMENT.CAPTURE.COMPLETED matters: it settles checkouts whose buyer closed the tab
   * before our capture call returned. Everything else is acknowledged and ignored.
   */
  async handlePayPalWebhook(rawBody: string, headers: WebhookHeaders): Promise<{ handled: boolean }> {
    if (!(await paymentProvider.verifyWebhook(headers, rawBody))) {
      throw AppError.badRequest('Invalid webhook signature');
    }

    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PayPalWebhookEvent;
    } catch {
      throw AppError.badRequest('Invalid webhook payload');
    }
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return { handled: false };
    }

    const providerOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const captureId = event.resource?.id;
    if (!providerOrderId || !captureId) {
      logger.warn({ eventId: event.id }, 'PayPal capture webhook without order/capture id - ignored');
      return { handled: false };
    }

    const payments = await this.repo.findByProviderOrderId(providerOrderId);
    if (payments.length === 0) {
      logger.warn({ providerOrderId }, 'PayPal capture webhook for an unknown order - ignored');
      return { handled: false };
    }
    if (payments.every((p) => p.status === PaymentStatus.COMPLETED)) {
      return { handled: true };
    }

    await this.settle(payments, captureId, event);
    return { handled: true };
  }

  async getPaymentStatus(buyerId: string, paymentId: string) {
    const payment = await this.repo.findByIdWithOrder(paymentId);
    if (!payment || payment.order.buyerId !== buyerId) {
      throw AppError.notFound('Payment not found');
    }
    return payment;
  }

  async getInvoice(requesterId: string, requesterRole: Role, orderId: string): Promise<Invoice> {
    const order =
      requesterRole === Role.SUPER_ADMIN
        ? await this.orders.getForAdmin(orderId)
        : await this.orders.getMyOrder(requesterId, orderId);

    const orderRecord = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { include: { user: true } },
        sellerProfile: { select: { brand: { select: { name: true, legalName: true } } } },
      },
    });
    if (!orderRecord) {
      throw AppError.notFound('Order not found');
    }

    const brand = orderRecord.sellerProfile?.brand ?? null;

    const productIds = order.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    // Source the actually-charged currency/amount from the completed Payment —
    // adminPriceTotal on Order is always INR, but the buyer may have paid in
    // a converted currency (see checkout()). Fall back to INR if uncaptured.
    const completedPayment = await this.repo.findByOrderId(orderId);
    const currency = completedPayment?.status === 'COMPLETED' ? completedPayment.currency : 'INR';
    const total =
      completedPayment?.status === 'COMPLETED'
        ? completedPayment.amount.toString()
        : orderRecord.adminPriceTotal.toString();
    const fxRate = currency === 'INR' ? 1 : Number(total) / Number(orderRecord.adminPriceTotal);

    return {
      invoiceNumber: `SB-${orderRecord.id.slice(0, 8).toUpperCase()}`,
      orderId: orderRecord.id,
      issuedAt: orderRecord.createdAt,
      // Brand orders are sold by the brand (Solomon only facilitates the payment); curated stay Solomon.
      soldBy: brand ? (brand.legalName ?? brand.name) : SOLOMON_LEGAL_NAME,
      ...(brand ? { facilitatedBy: SOLOMON_LEGAL_NAME } : {}),
      buyerEmail: orderRecord.buyer.user.email,
      currency,
      items: order.items.map((item) => ({
        productName: nameById.get(item.productId) ?? 'Product',
        quantity: item.quantity,
        unitPrice: (Number(item.unitAdminPrice) * fxRate).toFixed(2),
        lineTotal: (Number(item.lineAdminTotal) * fxRate).toFixed(2),
      })),
      total,
    };
  }
}

export const paymentsService = new PaymentsService();
