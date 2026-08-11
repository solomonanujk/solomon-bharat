import { Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { paymentProvider } from '../../providers/payments';
import { prisma } from '../../config/prisma';
import { OrdersService, ordersService } from '../orders/orders.service';
import { PaymentsRepository, paymentsRepository } from './payments.repository';
import { CaptureResult, CheckoutInput, CheckoutResult, Invoice } from './payments.types';

export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository = paymentsRepository,
    private readonly orders: OrdersService = ordersService,
  ) {}

  async checkout(buyerId: string, input: CheckoutInput): Promise<CheckoutResult> {
    const order = await this.orders.createPendingOrder(buyerId, input.items, input.shippingAddressId);

    const providerOrder = await paymentProvider.createOrder({
      amount: Number(order.adminPriceTotal),
      currency: 'USD',
      referenceId: order.id,
    });

    const payment = await this.repo.create(order.id, Number(order.adminPriceTotal), {
      createOrderId: providerOrder.providerOrderId,
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
      approveUrl: providerOrder.approveUrl,
      adminPriceTotal: order.adminPriceTotal.toString(),
    };
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

    return {
      invoiceNumber: `SB-${orderRecord.id.slice(0, 8).toUpperCase()}`,
      orderId: orderRecord.id,
      issuedAt: orderRecord.createdAt,
      soldBy: 'Solomon Bharat Private Limited',
      buyerEmail: orderRecord.buyer.user.email,
      currency: 'USD',
      items: order.items.map((item) => ({
        productName: nameById.get(item.productId) ?? 'Product',
        quantity: item.quantity,
        unitPrice: item.unitAdminPrice.toString(),
        lineTotal: item.lineAdminTotal.toString(),
      })),
      total: orderRecord.adminPriceTotal.toString(),
    };
  }
}

export const paymentsService = new PaymentsService();
