import { Order, Payment, PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class PaymentsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(orderId: string, amount: number, currency: string, rawPayload: Prisma.InputJsonValue): Promise<Payment> {
    return this.db.payment.create({
      data: { orderId, amount, currency, provider: 'PAYPAL', status: PaymentStatus.PENDING, rawPayload },
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
