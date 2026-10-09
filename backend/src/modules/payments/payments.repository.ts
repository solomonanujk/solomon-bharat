import { Order, Payment, PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class PaymentsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(
    orderId: string,
    amount: number,
    currency: string,
    rawPayload: Prisma.InputJsonValue,
    checkoutId?: string,
  ): Promise<Payment> {
    return this.db.payment.create({
      data: {
        orderId,
        amount,
        currency,
        provider: 'PAYPAL',
        status: PaymentStatus.PENDING,
        rawPayload,
        checkoutId: checkoutId ?? null,
      },
    });
  }

  /** All Payment rows written by one checkout (one per sibling order). */
  findByCheckoutId(checkoutId: string): Promise<Payment[]> {
    return this.db.payment.findMany({ where: { checkoutId }, orderBy: { createdAt: 'asc' } });
  }

  /** Payment rows created against one PayPal order id (stored in rawPayload.createOrderId). */
  findByProviderOrderId(providerOrderId: string): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: { rawPayload: { path: ['createOrderId'], equals: providerOrderId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Marks still-unsettled rows (PENDING, or FAILED by an earlier failed capture attempt) COMPLETED
   * inside the settlement transaction. Keeps createOrderId by merging the capture payload.
   * Returns the number of rows changed - 0 means a replay.
   */
  async completeInTx(
    tx: Prisma.TransactionClient,
    paymentIds: string[],
    providerPaymentId: string,
    capturePayload: Prisma.InputJsonValue,
  ): Promise<number> {
    const rows = await tx.payment.findMany({
      where: { id: { in: paymentIds }, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
    });
    for (const row of rows) {
      const existing = (row.rawPayload && typeof row.rawPayload === 'object' ? row.rawPayload : {}) as Prisma.JsonObject;
      // eslint-disable-next-line no-await-in-loop
      await tx.payment.update({
        where: { id: row.id },
        data: {
          status: PaymentStatus.COMPLETED,
          providerPaymentId,
          rawPayload: { ...existing, capture: capturePayload },
        },
      });
    }
    return rows.length;
  }

  async setManyFailed(paymentIds: string[], rawPayload: Prisma.InputJsonValue): Promise<void> {
    await this.db.payment.updateMany({
      where: { id: { in: paymentIds }, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, rawPayload },
    });
  }

  findById(id: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { id } });
  }

  findByIdWithOrder(id: string): Promise<(Payment & { order: Order }) | null> {
    return this.db.payment.findUnique({ where: { id }, include: { order: true } });
  }

  findByOrderId(orderId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  setCompleted(id: string, providerPaymentId: string, rawPayload: Prisma.InputJsonValue): Promise<Payment> {
    return this.db.payment.update({
      where: { id },
      data: { status: PaymentStatus.COMPLETED, providerPaymentId, rawPayload },
    });
  }

  setFailed(id: string, rawPayload: Prisma.InputJsonValue): Promise<Payment> {
    return this.db.payment.update({ where: { id }, data: { status: PaymentStatus.FAILED, rawPayload } });
  }
}

export const paymentsRepository = new PaymentsRepository();
