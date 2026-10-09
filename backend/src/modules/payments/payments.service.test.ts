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
    verifyWebhook: vi.fn(),
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
    sellerProfileId: null,
    checkoutId: null,
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
    checkoutId: null,
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
    findByCheckoutId: vi.fn(),
    findByProviderOrderId: vi.fn(),
    completeInTx: vi.fn().mockResolvedValue(1),
    setManyFailed: vi.fn(),
  } as unknown as PaymentsRepository;
}

function buildMockOrders(): OrdersService {
  return {
    createPendingCheckout: vi.fn(),
    markCheckoutPaid: vi.fn(),
    getForAdmin: vi.fn(),
    getMyOrder: vi.fn(),
  } as unknown as OrdersService;
}

describe('PaymentsService', () => {
  let repo: PaymentsRepository;
  let orders: OrdersService;
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = buildMockRepo();
    orders = buildMockOrders();
    service = new PaymentsService(repo, orders);
  });

  describe('checkout', () => {
    function pending(id: string, total: number, sellerProfileId: string | null = null) {
      return {
        ...buildOrder({ id, adminPriceTotal: new Decimal(total), sellerProfileId }),
        items: [],
      };
    }

    it('creates sibling orders, ONE PayPal order, and one pro-rata Payment row per order sharing the checkoutId', async () => {
      vi.mocked(orders.createPendingCheckout).mockResolvedValue({
        checkoutId: 'checkout-1',
        orders: [pending('order-curated', 100), pending('order-brand-a', 200, 'sp-a'), pending('order-brand-b', 50, 'sp-b')],
      });
      vi.mocked(paymentProvider.createOrder).mockResolvedValue({
        providerOrderId: 'PAYPAL-ORDER-1',
        approveUrl: 'https://paypal.example/approve',
      });
      vi.mocked(repo.create).mockImplementation(async (orderId, amount) =>
        buildPayment({ id: `pay-${orderId}`, orderId, amount: new Decimal(amount) }),
      );

      const result = await service.checkout(
        'buyer-1',
        { items: [{ productId: 'prod-1', quantity: 10 }], currency: 'USD' },
        'BUYER',
      );

      // INR 350 at the mocked 0.012 USD rate -> 4.20, a single PayPal charge for the whole checkout
      expect(paymentProvider.createOrder).toHaveBeenCalledTimes(1);
      expect(paymentProvider.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 4.2, currency: 'USD', referenceId: 'checkout-1' }),
      );
      expect(repo.create).toHaveBeenCalledTimes(3);
      const rows = vi.mocked(repo.create).mock.calls;
      expect(rows.map((c) => c[0])).toEqual(['order-curated', 'order-brand-a', 'order-brand-b']);
      expect(rows.every((c) => c[3] && (c[3] as { createOrderId: string }).createOrderId === 'PAYPAL-ORDER-1')).toBe(true);
      expect(rows.every((c) => c[4] === 'checkout-1')).toBe(true);
      const sum = rows.reduce((acc, c) => acc + Math.round(c[1] * 100), 0);
      expect(sum).toBe(420);

      expect(result.checkoutId).toBe('checkout-1');
      expect(result.orders).toEqual([
        { orderId: 'order-curated', sellerProfileId: null },
        { orderId: 'order-brand-a', sellerProfileId: 'sp-a' },
        { orderId: 'order-brand-b', sellerProfileId: 'sp-b' },
      ]);
      expect(result.adminPriceTotal).toBe('350.00');
      expect(result.approveUrl).toBe('https://paypal.example/approve');
    });

    it('puts the rounding remainder on the last row so rows always sum to the PayPal charge', async () => {
      vi.mocked(orders.createPendingCheckout).mockResolvedValue({
        checkoutId: 'checkout-2',
        orders: [pending('o1', 100), pending('o2', 100), pending('o3', 100)],
      });
      vi.mocked(paymentProvider.createOrder).mockResolvedValue({ providerOrderId: 'P2', approveUrl: null });
      vi.mocked(repo.create).mockImplementation(async (orderId, amount) =>
        buildPayment({ orderId, amount: new Decimal(amount) }),
      );

      await service.checkout('buyer-1', { items: [{ productId: 'p', quantity: 1 }], currency: 'INR' }, 'BUYER');

      const amounts = vi.mocked(repo.create).mock.calls.map((c) => Math.round(c[1] * 100));
      expect(amounts).toEqual([10000, 10000, 10000]);

      vi.mocked(repo.create).mockClear();
      vi.mocked(orders.createPendingCheckout).mockResolvedValue({
        checkoutId: 'checkout-3',
        orders: [pending('o1', 33.33), pending('o2', 33.33), pending('o3', 33.34)],
      });
      await service.checkout('buyer-1', { items: [{ productId: 'p', quantity: 1 }], currency: 'USD' }, 'BUYER');
      const usd = vi.mocked(repo.create).mock.calls.map((c) => Math.round(c[1] * 100));
      // 100.00 INR * 0.012 = 1.20 USD
      expect(usd.reduce((a, b) => a + b, 0)).toBe(120);
    });

    it('charges directly in INR with no conversion when the buyer pays in the platform currency', async () => {
      vi.mocked(orders.createPendingCheckout).mockResolvedValue({
        checkoutId: 'checkout-4',
        orders: [pending('order-1', 120)],
      });
      vi.mocked(paymentProvider.createOrder).mockResolvedValue({
        providerOrderId: 'PAYPAL-ORDER-2',
        approveUrl: 'https://paypal.example/approve',
      });
      vi.mocked(repo.create).mockResolvedValue(buildPayment({ currency: 'INR' }));

      await service.checkout(
        'buyer-1',
        { items: [{ productId: 'prod-1', quantity: 10 }], currency: 'INR' },
        'BUYER',
      );

      expect(paymentProvider.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 120, currency: 'INR' }),
      );
      expect(repo.create).toHaveBeenCalledWith('order-1', 120, 'INR', { createOrderId: 'PAYPAL-ORDER-2' }, 'checkout-4');
    });

    it('does not start PayPal when the order split is rejected (e.g. minimum order value)', async () => {
      vi.mocked(orders.createPendingCheckout).mockRejectedValue({ statusCode: 422 });

      await expect(
        service.checkout('buyer-1', { items: [{ productId: 'p', quantity: 1 }], currency: 'USD' }, 'BUYER'),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(paymentProvider.createOrder).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    const siblings = [
      buildPayment({ id: 'pay-1', orderId: 'order-1', checkoutId: 'co-1' }),
      buildPayment({ id: 'pay-2', orderId: 'order-2', checkoutId: 'co-1' }),
    ];

    it('rejects capturing a payment that belongs to another buyer', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment(),
        order: buildOrder({ buyerId: 'someone-else' }),
      });

      await expect(service.capture('buyer-1', 'payment-1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('is idempotent: capturing an already-settled checkout returns COMPLETED without touching PayPal', async () => {
      const done = siblings.map((p) => ({ ...p, status: PaymentStatus.COMPLETED }));
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...done[0], order: buildOrder() });
      vi.mocked(repo.findByCheckoutId).mockResolvedValue(done);

      const result = await service.capture('buyer-1', 'pay-1');

      expect(result.status).toBe('COMPLETED');
      expect(paymentProvider.captureOrder).not.toHaveBeenCalled();
      expect(orders.markCheckoutPaid).not.toHaveBeenCalled();
    });

    it('rejects capturing a payment that already failed', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({
        ...buildPayment({ status: PaymentStatus.FAILED }),
        order: buildOrder(),
      });

      await expect(service.capture('buyer-1', 'payment-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('on success: one PayPal capture, then ONE settle covering every sibling order and payment row', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...siblings[0], order: buildOrder() });
      vi.mocked(repo.findByCheckoutId).mockResolvedValue(siblings);
      vi.mocked(paymentProvider.captureOrder).mockResolvedValue({
        status: 'COMPLETED',
        providerPaymentId: 'CAPTURE-1',
        raw: { id: 'cap' },
      });
      vi.mocked(repo.findById).mockResolvedValue({ ...siblings[0], status: PaymentStatus.COMPLETED });
      const tx = {} as never;
      vi.mocked(orders.markCheckoutPaid).mockImplementation(async (_ids, inTx) => {
        await inTx?.(tx);
        return { settledOrderIds: ['order-1', 'order-2'], brandOrderIds: [] };
      });

      const result = await service.capture('buyer-1', 'pay-1');

      expect(paymentProvider.captureOrder).toHaveBeenCalledTimes(1);
      expect(paymentProvider.captureOrder).toHaveBeenCalledWith('PAYPAL-ORDER-1');
      expect(orders.markCheckoutPaid).toHaveBeenCalledWith(['order-1', 'order-2'], expect.any(Function));
      // the Payment rows are completed INSIDE the same transaction as the orders
      expect(repo.completeInTx).toHaveBeenCalledWith(tx, ['pay-1', 'pay-2'], 'CAPTURE-1', { id: 'cap' });
      expect(result.status).toBe('COMPLETED');
    });

    it('legacy payment rows without a checkoutId settle on their own', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...buildPayment(), order: buildOrder() });
      vi.mocked(paymentProvider.captureOrder).mockResolvedValue({ status: 'COMPLETED', providerPaymentId: 'C', raw: {} });
      vi.mocked(repo.findById).mockResolvedValue(buildPayment({ status: PaymentStatus.COMPLETED }));

      await service.capture('buyer-1', 'payment-1');

      expect(repo.findByCheckoutId).not.toHaveBeenCalled();
      expect(orders.markCheckoutPaid).toHaveBeenCalledWith(['order-1'], expect.any(Function));
    });

    it('on failed capture: marks every payment row FAILED and does not touch the orders', async () => {
      vi.mocked(repo.findByIdWithOrder).mockResolvedValue({ ...siblings[0], order: buildOrder() });
      vi.mocked(repo.findByCheckoutId).mockResolvedValue(siblings);
      vi.mocked(paymentProvider.captureOrder).mockResolvedValue({
        status: 'FAILED',
        providerPaymentId: null,
        raw: { reason: 'declined' },
      });
      vi.mocked(repo.findById).mockResolvedValue({ ...siblings[0], status: PaymentStatus.FAILED });

      const result = await service.capture('buyer-1', 'pay-1');

      expect(repo.setManyFailed).toHaveBeenCalledWith(['pay-1', 'pay-2'], { reason: 'declined' });
      expect(orders.markCheckoutPaid).not.toHaveBeenCalled();
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

  describe('handlePayPalWebhook', () => {
    const event = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        id: 'WH-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAPTURE-9', supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } } },
        ...overrides,
      });
    const pendingRows = [
      buildPayment({ id: 'pay-1', orderId: 'order-1', checkoutId: 'co-1' }),
      buildPayment({ id: 'pay-2', orderId: 'order-2', checkoutId: 'co-1' }),
    ];

    beforeEach(() => {
      vi.mocked(paymentProvider.verifyWebhook).mockResolvedValue(true);
    });

    it('rejects a webhook whose signature does not verify, without touching anything', async () => {
      vi.mocked(paymentProvider.verifyWebhook).mockResolvedValue(false);

      await expect(service.handlePayPalWebhook(event(), {})).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.findByProviderOrderId).not.toHaveBeenCalled();
      expect(orders.markCheckoutPaid).not.toHaveBeenCalled();
    });

    it('verifies against the RAW body string', async () => {
      const raw = event();
      vi.mocked(repo.findByProviderOrderId).mockResolvedValue([]);
      await service.handlePayPalWebhook(raw, { 'paypal-transmission-id': 'x' });
      expect(paymentProvider.verifyWebhook).toHaveBeenCalledWith({ 'paypal-transmission-id': 'x' }, raw);
    });

    it('settles the whole checkout with the same settle function as capture', async () => {
      vi.mocked(repo.findByProviderOrderId).mockResolvedValue(pendingRows);
      const tx = {} as never;
      vi.mocked(orders.markCheckoutPaid).mockImplementation(async (_ids, inTx) => {
        await inTx?.(tx);
        return { settledOrderIds: ['order-1', 'order-2'], brandOrderIds: [] };
      });

      const result = await service.handlePayPalWebhook(event(), {});

      expect(result).toEqual({ handled: true });
      expect(repo.findByProviderOrderId).toHaveBeenCalledWith('PAYPAL-ORDER-1');
      expect(orders.markCheckoutPaid).toHaveBeenCalledWith(['order-1', 'order-2'], expect.any(Function));
      expect(repo.completeInTx).toHaveBeenCalledWith(tx, ['pay-1', 'pay-2'], 'CAPTURE-9', expect.any(Object));
    });

    it('is idempotent: a replay for an already-completed checkout does nothing', async () => {
      vi.mocked(repo.findByProviderOrderId).mockResolvedValue(
        pendingRows.map((p) => ({ ...p, status: PaymentStatus.COMPLETED })),
      );

      const result = await service.handlePayPalWebhook(event(), {});

      expect(result).toEqual({ handled: true });
      expect(orders.markCheckoutPaid).not.toHaveBeenCalled();
    });

    it('acknowledges and ignores other event types', async () => {
      const result = await service.handlePayPalWebhook(event({ event_type: 'CHECKOUT.ORDER.APPROVED' }), {});
      expect(result).toEqual({ handled: false });
      expect(repo.findByProviderOrderId).not.toHaveBeenCalled();
    });

    it('ignores a capture event for an order we do not know', async () => {
      vi.mocked(repo.findByProviderOrderId).mockResolvedValue([]);
      expect(await service.handlePayPalWebhook(event(), {})).toEqual({ handled: false });
      expect(orders.markCheckoutPaid).not.toHaveBeenCalled();
    });

    it('ignores a capture event without order/capture ids and rejects malformed JSON', async () => {
      expect(await service.handlePayPalWebhook(event({ resource: {} }), {})).toEqual({ handled: false });
      await expect(service.handlePayPalWebhook('not json', {})).rejects.toMatchObject({ statusCode: 400 });
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

  describe('getInvoice soldBy', () => {
    const items = [{ productId: 'prod-1', quantity: 1, unitAdminPrice: '10', lineAdminTotal: '10' }];
    const record = (sellerProfile: unknown) =>
      ({
        id: 'order-1',
        createdAt: new Date('2026-01-01'),
        adminPriceTotal: { toString: () => '10' },
        buyer: { user: { email: 'b@example.com' } },
        sellerProfile,
      }) as never;

    it('brand orders are sold by the brand legal name, facilitated by Solomon Bharat', async () => {
      vi.mocked(orders.getMyOrder).mockResolvedValue({ items } as never);
      vi.mocked(prisma.order.findUnique).mockResolvedValue(record({ brand: { name: 'Brand A', legalName: 'Brand A Exports LLP' } }));
      vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: 'prod-1', name: 'Runner' }] as never);

      const invoice = await service.getInvoice('buyer-1', 'BUYER' as never, 'order-1');

      expect(invoice.soldBy).toBe('Brand A Exports LLP');
      expect(invoice.facilitatedBy).toBe('Solomon Bharat Private Limited');
    });

    it('falls back to the brand name when no legal name is on file', async () => {
      vi.mocked(orders.getMyOrder).mockResolvedValue({ items } as never);
      vi.mocked(prisma.order.findUnique).mockResolvedValue(record({ brand: { name: 'Brand A', legalName: null } }));
      vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

      expect((await service.getInvoice('buyer-1', 'BUYER' as never, 'order-1')).soldBy).toBe('Brand A');
    });

    it('curated orders stay sold by Solomon Bharat with no facilitatedBy', async () => {
      vi.mocked(orders.getMyOrder).mockResolvedValue({ items } as never);
      vi.mocked(prisma.order.findUnique).mockResolvedValue(record(null));
      vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

      const invoice = await service.getInvoice('buyer-1', 'BUYER' as never, 'order-1');

      expect(invoice.soldBy).toBe('Solomon Bharat Private Limited');
      expect(invoice).not.toHaveProperty('facilitatedBy');
    });
  });
});
