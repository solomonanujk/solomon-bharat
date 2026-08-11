import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { PaymentsRepository } from './payments.repository';

describe('PaymentsRepository', () => {
  let db: MockPrismaClient;
  let repo: PaymentsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ payment: mockModel() });
    repo = new PaymentsRepository(db as never);
  });

  it('create starts a PENDING PayPal payment', async () => {
    db.payment.create.mockResolvedValue({ id: 'pay-1' });
    await repo.create('order-1', 100, { raw: true });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: { orderId: 'order-1', amount: 100, provider: 'PAYPAL', status: PaymentStatus.PENDING, rawPayload: { raw: true } },
    });
  });

  it('findByIdWithOrder includes the related order', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
    await repo.findByIdWithOrder('pay-1');
    expect(db.payment.findUnique).toHaveBeenCalledWith({ where: { id: 'pay-1' }, include: { order: true } });
  });

  it('findByOrderId returns the most recent payment for the order', async () => {
    db.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
    await repo.findByOrderId('order-1');
    expect(db.payment.findFirst).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('setCompleted marks COMPLETED and records the provider payment id', async () => {
    db.payment.update.mockResolvedValue({ id: 'pay-1' });
    await repo.setCompleted('pay-1', 'PAYPAL-CAP-1', { captured: true });
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: PaymentStatus.COMPLETED, providerPaymentId: 'PAYPAL-CAP-1', rawPayload: { captured: true } },
    });
  });

  it('setFailed marks FAILED', async () => {
    db.payment.update.mockResolvedValue({ id: 'pay-1' });
    await repo.setFailed('pay-1', { error: 'declined' });
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: PaymentStatus.FAILED, rawPayload: { error: 'declined' } },
    });
  });
});
