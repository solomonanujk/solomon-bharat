import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Order, OrderStatus, Payment, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrdersService } from '../orders/orders.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

vi.mock('../../providers/payments', () => ({
  paymentProvider: {
    createOrder: vi.fn(),
    captureOrder: vi.fn(),
  },
}));

vi.mock('../../providers/fx', () => ({
  fxProvider: {
    getRatesFromInr: vi.fn().mockResolvedValue({ base: 'INR', date: '2026-01-01', rates: { USD: 0.012 } }),
  },
}));

vi.mock('../../config/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

import { paymentProvider } from '../../providers/payments';
import { prisma } from '../../config/prisma';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    shippingAddressId: null,
    status: OrderStatus.PENDING_PAYMENT,
    adminPriceTotal: new Decimal(120),
    sellerPriceTotal: new Decimal(50),
    adminMargin: new Decimal(70),
    trackingNumber: null,
    exportDocuments: null,
    expectedCollectionDate: null,
    cancelledReason: null,
    placedAsAgent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    provider: 'PAYPAL',
    providerPaymentId: null,
    amount: new Decimal(120),
    currency: 'USD',
    status: PaymentStatus.PENDING,
    rawPayload: { createOrderId: 'PAYPAL-ORDER-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): PaymentsRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithOrder: vi.fn(),
    findByOrderId: vi.fn(),
    setCompleted: vi.fn(),
    setFailed: vi.fn(),
  } as unknown as PaymentsRepository;
}

function buildMockOrders(): OrdersService {
  return {
    createPendingOrder: vi.fn(),
    markPaymentReceived: vi.fn(),
    getForAdmin: vi.fn(),
    getMyOrder: vi.fn(),
  } as unknown as OrdersService;
}

describe('PaymentsService', () => {
  let repo: PaymentsRepository;
  let orders: OrdersService;
  let service: PaymentsService;

  beforeEach(() => {
    repo = buildMockRepo();
    orders = buildMockOrders();
    service = new PaymentsService(repo, orders);
  });

  describe('checkout', () => {
    it('creates a pending order, a PayPal order, and a PENDING payment row', async () => {
      vi.mocked(orders.createPendingOrder).mockResolvedValue({ ...buildOrder(), items: [] });
      vi.mocked(paymentProvider.createOrder).mockResolvedValue({
        providerOrderId: 'PAYPAL-ORDER-1',
        approveUrl: 'https://paypal.example/approve',
      });
      vi.mocked(repo.create).mockResolvedValue(buildPayment());

      const result = await service.checkout(
        'buyer-1',
        {
          items: [{ productId: 'prod-1', quantity: 10 }],
          currency: 'USD',
        },
        'BUYER',
      );

      // adminPriceTotal (INR 120) converted at the mocked USD rate of 0.012 → 1.44
      expect(paymentProvider.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1.44, currency: 'USD', referenceId: 'order-1' }),
      );
      expect(repo.create).toHaveBeenCalledWith('order-1', 1.44, 'USD', { createOrderId: 'PAYPAL-ORDER-1' });
      expect(result.approveUrl).toBe('https://paypal.example/approve');
      expect(result.currency).toBe('USD');
    });

    it('charges directly in INR with no conversion when the buyer pays in the platform currency', async () => {
      vi.mocked(orders.createPendingOrder).mockResolvedValue({ ...buildOrder(), items: [] });
      vi.mocked(paymentProvider.createOrder).mockResolvedValue({
        providerOrderId: 'PAYPAL-ORDER-2',
        approveUrl: 'https://paypal.example/approve',
      });
      vi.mocked(repo.create).mockResolvedValue(buildPayment({ currency: 'INR' }));

      await service.checkout(
        'buyer-1',
        {
          items: [{ productId: 'prod-1', quantity: 10 }],
          currency: 'INR',
        },
        'BUYER',
      );

      expect(paymentProvider.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 120, currency: 'INR' }),
      );
      expect(repo.create).toHaveBeenCalledWith('order-1', 120, 'INR', { createOrderId: 'PAYPAL-ORDER-2' });
    });
  });

  describe('capture', () => {
    it('rejects capturing a payment that belongs to another buyer', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment(),
        order: buildOrder({ buyerId: 'someone-else' }),
      });

      await expect(service.capture('buyer-1', 'payment-1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects capturing a payment that is already completed', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment({ status: PaymentStatus.COMPLETED }),
        order: buildOrder(),
      });

      await expect(service.capture('buyer-1', 'payment-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('on successful capture: completes the payment and flips the order to PAYMENT_RECEIVED', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...buildPayment(), order: buildOrder() });
      vi.mocked(paymentProvider.captureOrder).mockResolvedValue({
        status: 'COMPLETED',
        providerPaymentId: 'CAPTURE-1',
        raw: {},
      });
      vi.mocked(repo.setCompleted).mockResolvedValue(buildPayment({ status: PaymentStatus.COMPLETED }));

      const result = await service.capture('buyer-1', 'payment-1');

      expect(repo.setCompleted).toHaveBeenCalledWith('payment-1', 'CAPTURE-1', {});
      expect(orders.markPaymentReceived).toHaveBeenCalledWith('order-1');
      expect(result.status).toBe('COMPLETED');
    });

    it('on failed capture: marks the payment FAILED and does not touch the order', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...buildPayment(), order: buildOrder() });
      vi.mocked(paymentProvider.captureOrder).mockResolvedValue({
        status: 'FAILED',
        providerPaymentId: null,
        raw: { reason: 'declined' },
      });
      vi.mocked(repo.setFailed).mockResolvedValue(buildPayment({ status: PaymentStatus.FAILED }));

      const result = await service.capture('buyer-1', 'payment-1');

      expect(repo.setFailed).toHaveBeenCalledWith('payment-1', { reason: 'declined' });
      expect(orders.markPaymentReceived).not.toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
    });

    it('rejects capturing a payment with no provider order reference on file', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment({ rawPayload: {} }),
        order: buildOrder(),
      });

      await expect(service.capture('buyer-1', 'payment-1')).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('getPaymentStatus', () => {
    it('rejects a payment belonging to another buyer', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment(),
        order: buildOrder({ buyerId: 'someone-else' }),
      });

      await expect(service.getPaymentStatus('buyer-1', 'payment-1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('returns the payment for its owning buyer', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...buildPayment(), order: buildOrder() });

      const result = await service.getPaymentStatus('buyer-1', 'payment-1');

      expect(result.id).toBe('payment-1');
    });
  });

  describe('getInvoice', () => {
    const orderItems = [
      { productId: 'prod-1', quantity: 5, unitAdminPrice: '20', lineAdminTotal: '100' },
    ];

    it('SUPER_ADMIN can fetch any order\'s invoice via getForAdmin', async () => {
      vi.mocked(orders.getForAdmin).mockResolvedValue({ items: orderItems } as never);
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        createdAt: new Date('2026-01-01'),
        adminPriceTotal: { toString: () => '100' },
        buyer: { user: { email: 'buyer@example.com' } },
      } as never);
      vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: 'prod-1', name: 'Table Runner' }] as never);

      const invoice = await service.getInvoice('admin-1', 'SUPER_ADMIN' as never, 'order-1');

      expect(orders.getForAdmin).toHaveBeenCalledWith('order-1');
      expect(orders.getMyOrder).not.toHaveBeenCalled();
      expect(invoice.items[0]).toMatchObject({ productName: 'Table Runner', quantity: 5 });
      expect(invoice.buyerEmail).toBe('buyer@example.com');
    });

    it('a BUYER fetches their own order via getMyOrder, never getForAdmin', async () => {
      vi.mocked(orders.getMyOrder).mockResolvedValue({ items: orderItems } as never);
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        createdAt: new Date('2026-01-01'),
        adminPriceTotal: { toString: () => '100' },
        buyer: { user: { email: 'buyer@example.com' } },
      } as never);
      vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: 'prod-1', name: 'Table Runner' }] as never);

      await service.getInvoice('buyer-1', 'BUYER' as never, 'order-1');

      expect(orders.getMyOrder).toHaveBeenCalledWith('buyer-1', 'order-1');
      expect(orders.getForAdmin).not.toHaveBeenCalled();
    });
  });
});
