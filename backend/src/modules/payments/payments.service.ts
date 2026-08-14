import { Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { paymentProvider } from '../../providers/payments';
import { fxProvider } from '../../providers/fx';
import { prisma } from '../../config/prisma';
import { OrdersService, ordersService } from '../orders/orders.service';
import { PaymentsRepository, paymentsRepository } from './payments.repository';
import { CaptureResult, CheckoutInput, CheckoutResult, FxRateResult, Invoice } from './payments.types';

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

  async checkout(buyerId: string, input: CheckoutInput): Promise<CheckoutResult> {
    const order = await this.orders.createPendingOrder(buyerId, input.items, input.shippingAddressId);

    const { amount: chargeAmount } = await convertFromInr(Number(order.adminPriceTotal), input.currency);

    const providerOrder = await paymentProvider.createOrder({
      amount: chargeAmount,
      currency: input.currency,
      referenceId: order.id,
    });

    const payment = await this.repo.create(order.id, chargeAmount, input.currency, {
      createOrderId: providerOrder.providerOrderId,
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
      approveUrl: providerOrder.approveUrl,
      adminPriceTotal: order.adminPriceTotal.toString(),
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

  async capture(buyerId: string, paymentId: string): Promise<CaptureResult> {
    const payment = await this.repo.findByIdWithOrder(paymentId);
    if (!payment) {
      throw AppError.notFound('Payment not found');
    }
    if (payment.order.buyerId !== buyerId) {
      throw AppError.forbidden('You do not have access to this payment');
    }
    if (payment.status !== 'PENDING') {
      throw AppError.badRequest(`Payment is already ${payment.status.toLowerCase()}`);
    }

    const rawPayload = payment.rawPayload as { createOrderId?: string } | null;
    const providerOrderId = rawPayload?.createOrderId;
    if (!providerOrderId) {
      throw AppError.internal('Payment is missing its provider order reference');
    }

    const result = await paymentProvider.captureOrder(providerOrderId);

    if (result.status === 'COMPLETED') {
      const updated = await this.repo.setCompleted(
        paymentId,
        result.providerPaymentId ?? providerOrderId,
        result.raw as never,
      );
      await this.orders.markPaymentReceived(payment.orderId);
      return { payment: updated, orderId: payment.orderId, status: 'COMPLETED' };
    }

    const updated = await this.repo.setFailed(paymentId, result.raw as never);
    return { payment: updated, orderId: payment.orderId, status: 'FAILED' };
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
      include: { buyer: { include: { user: true } } },
    });
    if (!orderRecord) {
      throw AppError.notFound('Order not found');
    }

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
      soldBy: 'Solomon Bharat Private Limited',
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
