import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    await repo.create('order-1', 100, 'USD', { raw: true });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        amount: 100,
        currency: 'USD',
        provider: 'PAYPAL',
        status: PaymentStatus.PENDING,
        rawPayload: { raw: true },
        checkoutId: null,
      },
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

  it('findByProviderOrderId matches the PayPal order id stored in rawPayload', async () => {
    db.payment.findMany.mockResolvedValue([]);
    await repo.findByProviderOrderId('PP-1');
    expect(db.payment.findMany.mock.calls[0][0].where).toEqual({
      rawPayload: { path: ['createOrderId'], equals: 'PP-1' },
    });
  });

  it('findByCheckoutId returns every row of the checkout', async () => {
    db.payment.findMany.mockResolvedValue([]);
    await repo.findByCheckoutId('co-1');
    expect(db.payment.findMany.mock.calls[0][0].where).toEqual({ checkoutId: 'co-1' });
  });

  it('completeInTx completes only unsettled rows and keeps createOrderId alongside the capture payload', async () => {
    const tx = { payment: { findMany: vi.fn(), update: vi.fn() } };
    tx.payment.findMany.mockResolvedValue([{ id: 'p1', rawPayload: { createOrderId: 'PP-1' } }]);
    const n = await repo.completeInTx(tx as never, ['p1', 'p2'], 'CAP-1', { ok: true });
    expect(n).toBe(1);
    expect(tx.payment.findMany.mock.calls[0][0].where.status).toEqual({
      in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        status: PaymentStatus.COMPLETED,
        providerPaymentId: 'CAP-1',
        rawPayload: { createOrderId: 'PP-1', capture: { ok: true } },
      },
    });
  });

  it('completeInTx is a no-op on replay (nothing left unsettled)', async () => {
    const tx = { payment: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() } };
    expect(await repo.completeInTx(tx as never, ['p1'], 'CAP-1', {})).toBe(0);
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('setManyFailed only fails rows that are still PENDING', async () => {
    await repo.setManyFailed(['p1', 'p2'], { r: 1 });
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, rawPayload: { r: 1 } },
    });
  });
});
