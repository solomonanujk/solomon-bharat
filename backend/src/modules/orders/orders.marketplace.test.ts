import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandStatus, Order, OrderItem, OrderStatus, ProductApprovalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductsService } from '../products/products.service';
import { BuyersService } from '../buyers/buyers.service';
import { PayoutsService } from '../payouts/payouts.service';
import { OrdersRepository } from './orders.repository';
import { MIN_ORDER_VALUE_NOT_MET, OrdersService, toBrandOrderView } from './orders.service';
import { BrandOrderRecord, CheckoutBrand, CommissionRatesPort, DbTx, OrderWithItems } from './orders.types';

vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../config/prisma', () => ({
  prisma: { buyerProfile: { findUnique: vi.fn().mockResolvedValue({ userId: 'buyer-user-1' }) } },
}));
vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifyOrderStatusChanged: vi.fn().mockResolvedValue(undefined),
    notifyBrandNewOrder: vi.fn().mockResolvedValue(undefined),
  },
}));

import { notificationsService } from '../notifications/notifications.service';

// ── fixtures ────────────────────────────────────────────────────────────

function product(id: string, opts: { brandId?: string | null; sellerId?: string; admin: number; seller?: number; moq?: number }) {
  return {
    id,
    name: `Product ${id}`,
    sellerId: opts.sellerId ?? 'seller-curated',
    brandId: opts.brandId ?? null,
    moq: opts.moq ?? 1,
    sellerPrice: new Decimal(opts.seller ?? opts.admin),
    adminPrice: new Decimal(opts.admin),
    agentPrice: null,
    approvalStatus: ProductApprovalStatus.APPROVED,
    isPublished: true,
    deletedAt: null,
    variants: [],
    priceTiers: [] as { moq: number; sellerPrice: Decimal; adminPrice: Decimal | null; agentPrice: Decimal | null }[],
  };
}

const brandA: CheckoutBrand = {
  id: 'brand-a',
  sellerProfileId: 'sp-a',
  name: 'Brand A',
  status: BrandStatus.ACTIVE,
  minOrderValueInr: new Decimal(1000),
};
const brandB: CheckoutBrand = {
  id: 'brand-b',
  sellerProfileId: 'sp-b',
  name: 'Brand B',
  status: BrandStatus.ACTIVE,
  minOrderValueInr: new Decimal(0),
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    sellerProfileId: null,
    checkoutId: null,
    shippingAddressId: null,
    status: OrderStatus.PENDING_PAYMENT,
    adminPriceTotal: new Decimal(1000),
    sellerPriceTotal: new Decimal(1000),
    adminMargin: new Decimal(0),
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

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    orderId: 'order-1',
    productId: 'p1',
    variantId: null,
    sellerId: 'sp-a',
    quantity: 10,
    unitAdminPrice: new Decimal(100),
    unitSellerPrice: new Decimal(100),
    lineAdminTotal: new Decimal(1000),
    lineSellerTotal: new Decimal(1000),
    commissionRate: null,
    commissionAmount: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── service-level harness for checkout ──────────────────────────────────

function buildCheckoutHarness(productsById: Record<string, ReturnType<typeof product>>, brands: CheckoutBrand[]) {
  const repo = {
    createPending: vi.fn(async (input: { sellerProfileId?: string | null; checkoutId?: string; adminPriceTotal: number }) =>
      ({ ...order({ id: `order-${input.sellerProfileId ?? 'curated'}`, sellerProfileId: input.sellerProfileId ?? null, checkoutId: input.checkoutId ?? null, adminPriceTotal: new Decimal(input.adminPriceTotal) }), items: [] }) as OrderWithItems),
    findBrandsByIds: vi.fn(async (ids: string[]) => brands.filter((b) => ids.includes(b.id))),
  } as unknown as OrdersRepository;
  const products = {
    getForCheckout: vi.fn(async (id: string) => productsById[id]),
  } as unknown as ProductsService;
  const buyers = { verifyAddressOwnership: vi.fn() } as unknown as BuyersService;
  const service = new OrdersService(repo, products, buyers, {} as PayoutsService, {} as CommissionRatesPort);
  return { repo, service };
}

describe('OrdersService.createPendingCheckout (order split + minimum order value)', () => {
  it('splits a mixed cart into one curated order plus one order per brand, sharing a checkoutId', async () => {
    const { repo, service } = buildCheckoutHarness(
      {
        c1: product('c1', { admin: 100 }),
        a1: product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 300 }),
        a2: product('a2', { brandId: 'brand-a', sellerId: 'sp-a', admin: 200 }),
        b1: product('b1', { brandId: 'brand-b', sellerId: 'sp-b', admin: 50 }),
      },
      [brandA, brandB],
    );

    const result = await service.createPendingCheckout(
      'buyer-1',
      [
        { productId: 'a1', quantity: 2 }, // 600
        { productId: 'c1', quantity: 1 }, // 100
        { productId: 'a2', quantity: 2 }, // 400  -> brand A = 1000 (== min)
        { productId: 'b1', quantity: 3 }, // 150
      ],
      undefined,
      'BUYER',
    );

    expect(repo.createPending).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(repo.createPending).mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.sellerProfileId)).toEqual([null, 'sp-a', 'sp-b']);
    expect(calls.map((c) => c.adminPriceTotal)).toEqual([100, 1000, 150]);
    expect(calls[1].items.map((i) => i.productId)).toEqual(['a1', 'a2']);
    // one shared checkoutId
    const ids = new Set(calls.map((c) => c.checkoutId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(result.checkoutId);
    expect(result.orders).toHaveLength(3);
  });

  it('rejects a brand product for an agent (agents buy curated products only)', async () => {
    const { repo, service } = buildCheckoutHarness(
      { a1: product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 500 }) },
      [brandA],
    );

    await expect(
      service.createPendingCheckout('agent-1', [{ productId: 'a1', quantity: 2 }], undefined, 'AGENT'),
    ).rejects.toThrow(/not available for purchase/);
    expect(repo.createPending).not.toHaveBeenCalled();
  });

  it('rejects a tiered brand product for an agent', async () => {
    const tiered = product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 500 });
    tiered.priceTiers = [
      { moq: 1, sellerPrice: new Decimal(500), adminPrice: new Decimal(500), agentPrice: null },
      { moq: 50, sellerPrice: new Decimal(450), adminPrice: new Decimal(450), agentPrice: null },
    ];
    const agent = buildCheckoutHarness({ a1: tiered }, [brandA]);
    await expect(
      agent.service.createPendingCheckout('agent-1', [{ productId: 'a1', quantity: 60 }], undefined, 'AGENT'),
    ).rejects.toThrow(/not available for purchase/);

    // A buyer is unaffected and still gets the tier ladder.
    const buyer = buildCheckoutHarness({ a1: tiered }, [brandA]);
    await buyer.service.createPendingCheckout('buyer-1', [{ productId: 'a1', quantity: 60 }], undefined, 'BUYER');
    expect(vi.mocked(buyer.repo.createPending).mock.calls[0][0].items[0].unitAdminPrice).toBe(450);
  });

  it('a curated product still needs an agent price for an agent (unchanged)', async () => {
    const { service } = buildCheckoutHarness({ c1: product('c1', { admin: 100 }) }, []);
    await expect(
      service.createPendingCheckout('agent-1', [{ productId: 'c1', quantity: 1 }], undefined, 'AGENT'),
    ).rejects.toThrow(/no agent price/);
  });

  it('a curated-only cart creates a single order with no seller profile', async () => {
    const { repo, service } = buildCheckoutHarness({ c1: product('c1', { admin: 100 }) }, []);
    const { orders } = await service.createPendingCheckout('buyer-1', [{ productId: 'c1', quantity: 2 }], undefined, 'BUYER');

    expect(orders).toHaveLength(1);
    expect(repo.findBrandsByIds).not.toHaveBeenCalled();
    expect(vi.mocked(repo.createPending).mock.calls[0][0].sellerProfileId).toBeNull();
  });

  it('rejects with 422 MIN_ORDER_VALUE_NOT_MET listing each short brand, and creates no orders', async () => {
    const { repo, service } = buildCheckoutHarness(
      {
        a1: product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 100 }),
        c1: product('c1', { admin: 5000 }),
      },
      [brandA],
    );

    const err = await service
      .createPendingCheckout(
        'buyer-1',
        [
          { productId: 'a1', quantity: 5 }, // 500 < 1000
          { productId: 'c1', quantity: 1 }, // curated total must NOT count toward brand A's minimum
        ],
        undefined,
        'BUYER',
      )
      .catch((e: unknown) => e);

    expect(err).toMatchObject({
      statusCode: 422,
      details: {
        code: MIN_ORDER_VALUE_NOT_MET,
        details: [{ brandId: 'brand-a', brandName: 'Brand A', required: 1000, current: 500 }],
      },
    });
    expect(repo.createPending).not.toHaveBeenCalled();
  });

  it('enforces the minimum per brand: one brand met, another not, still rejected', async () => {
    const brandC: CheckoutBrand = { ...brandB, id: 'brand-c', sellerProfileId: 'sp-c', name: 'Brand C', minOrderValueInr: new Decimal(500) };
    const { service } = buildCheckoutHarness(
      {
        a1: product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 1000 }),
        c1: product('c1', { brandId: 'brand-c', sellerId: 'sp-c', admin: 100 }),
      },
      [brandA, brandC],
    );

    const err = await service
      .createPendingCheckout('buyer-1', [{ productId: 'a1', quantity: 1 }, { productId: 'c1', quantity: 1 }], undefined, 'BUYER')
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ statusCode: 422 });
    expect((err as { details: { details: unknown[] } }).details.details).toHaveLength(1);
    expect((err as { details: { details: { brandId: string }[] } }).details.details[0].brandId).toBe('brand-c');
  });

  it('accepts a brand order exactly at its minimum', async () => {
    const { service } = buildCheckoutHarness(
      { a1: product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 1000 }) },
      [brandA],
    );
    await expect(
      service.createPendingCheckout('buyer-1', [{ productId: 'a1', quantity: 1 }], undefined, 'BUYER'),
    ).resolves.toBeDefined();
  });

  it('rejects items from a SUSPENDED brand and items whose brand cannot be found', async () => {
    const suspended = { ...brandB, status: BrandStatus.SUSPENDED };
    const { service } = buildCheckoutHarness(
      { b1: product('b1', { brandId: 'brand-b', sellerId: 'sp-b', admin: 50 }) },
      [suspended],
    );
    await expect(
      service.createPendingCheckout('buyer-1', [{ productId: 'b1', quantity: 1 }], undefined, 'BUYER'),
    ).rejects.toMatchObject({ statusCode: 400 });

    const { service: orphaned } = buildCheckoutHarness(
      { b1: product('b1', { brandId: 'brand-b', sellerId: 'sp-b', admin: 50 }) },
      [],
    );
    await expect(
      orphaned.createPendingCheckout('buyer-1', [{ productId: 'b1', quantity: 1 }], undefined, 'BUYER'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('prices a brand product with a flat quantity ladder by the applicable tier, server-side', async () => {
    const tiered = {
      ...product('a1', { brandId: 'brand-a', sellerId: 'sp-a', admin: 400, moq: 10 }),
      priceTiers: [
        { moq: 10, sellerPrice: new Decimal(500), adminPrice: new Decimal(500), agentPrice: null },
        { moq: 50, sellerPrice: new Decimal(450), adminPrice: new Decimal(450), agentPrice: null },
        { moq: 200, sellerPrice: new Decimal(400), adminPrice: new Decimal(400), agentPrice: null },
      ],
    };
    const { repo, service } = buildCheckoutHarness({ a1: tiered }, [brandA]);

    await service.createPendingCheckout('buyer-1', [{ productId: 'a1', quantity: 60 }], undefined, 'BUYER');

    expect(repo.createPending).toHaveBeenCalledWith(expect.objectContaining({ adminPriceTotal: 27000 }));
  });

  it('createPendingOrder returns the first order of the checkout (curated compatibility)', async () => {
    const { service } = buildCheckoutHarness({ c1: product('c1', { admin: 100 }) }, []);
    const created = await service.createPendingOrder('buyer-1', [{ productId: 'c1', quantity: 1 }], undefined, 'BUYER');
    expect(created.sellerProfileId).toBeNull();
  });
});

// ── settlement: commission lock ─────────────────────────────────────────

type OrderRow = Order & { _committedStatus: OrderStatus };

/**
 * In-memory fake that models the parts of Postgres the commission lock relies on: READ COMMITTED
 * visibility (a transaction's own status writes are invisible to others until commit) and a
 * brand row lock that is held until the transaction ends.
 */
function buildFakeDb(initial: Order[], items: OrderItem[]) {
  const rows = new Map<string, OrderRow>(initial.map((o) => [o.id, { ...o, _committedStatus: o.status }]));
  const itemRows = new Map(items.map((i) => [i.id, { ...i }]));
  const lockQueue: Array<() => void> = [];
  let lockHeld = false;
  const events: string[] = [];

  const acquire = async () => {
    if (!lockHeld) {
      lockHeld = true;
      return;
    }
    await new Promise<void>((resolve) => lockQueue.push(resolve));
  };
  const release = () => {
    const next = lockQueue.shift();
    if (next) next();
    else lockHeld = false;
  };

  const repo = {
    runInTransaction: vi.fn(async <T,>(fn: (tx: DbTx) => Promise<T>): Promise<T> => {
      const pending: string[] = [];
      let holdsLock = false;
      const tx = { pending, markLocked: () => { holdsLock = true; } } as unknown as DbTx;
      events.push('tx:begin');
      try {
        const result = await fn(tx);
        // commit: own writes become visible
        for (const id of pending) rows.get(id)!._committedStatus = rows.get(id)!.status;
        events.push('tx:commit');
        return result;
      } finally {
        if (holdsLock) release();
      }
    }),
    markPaidIfPending: vi.fn(async (tx: DbTx, id: string) => {
      const row = rows.get(id)!;
      if (row.status !== OrderStatus.PENDING_PAYMENT) return false;
      row.status = OrderStatus.PAYMENT_RECEIVED;
      (tx as unknown as { pending: string[] }).pending.push(id);
      return true;
    }),
    findOrderInTx: vi.fn(async (_tx: DbTx, id: string) => ({ ...rows.get(id)! })),
    findBrandBySellerProfileId: vi.fn(async () => ({ id: 'brand-a', sellerProfileId: 'sp-a' })),
    lockBrand: vi.fn(async (tx: DbTx) => {
      events.push('lock');
      await acquire();
      (tx as unknown as { markLocked: () => void }).markLocked();
    }),
    countOtherPaidBrandOrders: vi.fn(async (_tx: DbTx, sellerProfileId: string, excludeId: string) => {
      events.push('count');
      return [...rows.values()].filter(
        (r) =>
          r.sellerProfileId === sellerProfileId &&
          r.id !== excludeId &&
          r._committedStatus !== OrderStatus.PENDING_PAYMENT &&
          r._committedStatus !== OrderStatus.CANCELLED,
      ).length;
    }),
    findItemsInTx: vi.fn(async (_tx: DbTx, orderId: string) => [...itemRows.values()].filter((i) => i.orderId === orderId)),
    updateItemCommission: vi.fn(async (_tx: DbTx, id: string, data: Record<string, number>) => {
      Object.assign(itemRows.get(id)!, {
        commissionRate: new Decimal(data.commissionRate),
        commissionAmount: new Decimal(data.commissionAmount),
        unitSellerPrice: new Decimal(data.unitSellerPrice),
        lineSellerTotal: new Decimal(data.lineSellerTotal),
      });
    }),
    updateOrderTotals: vi.fn(async (_tx: DbTx, id: string, data: { sellerPriceTotal: number; adminMargin: number }) => {
      Object.assign(rows.get(id)!, {
        sellerPriceTotal: new Decimal(data.sellerPriceTotal),
        adminMargin: new Decimal(data.adminMargin),
      });
    }),
  };
  return { repo: repo as unknown as OrdersRepository, rawRepo: repo, rows, itemRows, events };
}

function brandOrder(id: string, status: OrderStatus = OrderStatus.PENDING_PAYMENT): Order {
  return order({ id, sellerProfileId: 'sp-a', status, adminPriceTotal: new Decimal(1000), sellerPriceTotal: new Decimal(1000) });
}

describe('OrdersService.markCheckoutPaid (settle + commission lock)', () => {
  const rates = (first = 25, repeat = 15): CommissionRatesPort => ({
    resolveCommissionRates: vi.fn().mockResolvedValue({ first, repeat }),
  });

  beforeEach(() => vi.clearAllMocks());

  function service(db: ReturnType<typeof buildFakeDb>, ratesPort: CommissionRatesPort = rates()) {
    return new OrdersService(db.repo, {} as ProductsService, {} as BuyersService, {} as PayoutsService, ratesPort);
  }

  it('first paid order of a brand gets the FIRST rate and the net snapshot (net + commission == gross)', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    const outcome = await service(db).markCheckoutPaid(['o1']);

    expect(outcome).toEqual({ settledOrderIds: ['o1'], brandOrderIds: ['o1'] });
    const i = db.itemRows.get('i1')!;
    expect(Number(i.commissionRate)).toBe(25);
    expect(Number(i.commissionAmount)).toBe(250);
    expect(Number(i.lineSellerTotal)).toBe(750);
    expect(Number(i.unitSellerPrice)).toBe(75);
    expect(Number(i.commissionAmount) + Number(i.lineSellerTotal)).toBe(Number(i.lineAdminTotal));
    const o = db.rows.get('o1')!;
    expect(o.status).toBe(OrderStatus.PAYMENT_RECEIVED);
    expect(Number(o.sellerPriceTotal)).toBe(750);
    expect(Number(o.adminMargin)).toBe(250); // admin margin == commission
  });

  it('a later order gets the REPEAT rate when another order is already paid', async () => {
    const db = buildFakeDb(
      [brandOrder('o-old', OrderStatus.DELIVERED), brandOrder('o2')],
      [item({ id: 'i2', orderId: 'o2' })],
    );
    await service(db).markCheckoutPaid(['o2']);
    expect(Number(db.itemRows.get('i2')!.commissionRate)).toBe(15);
    expect(Number(db.itemRows.get('i2')!.commissionAmount)).toBe(150);
  });

  it('cancelled and unpaid orders do not count as the brand\'s first sale', async () => {
    const db = buildFakeDb(
      [brandOrder('o-cancelled', OrderStatus.CANCELLED), brandOrder('o-unpaid', OrderStatus.PENDING_PAYMENT), brandOrder('o3')],
      [item({ id: 'i3', orderId: 'o3' })],
    );
    await service(db).markCheckoutPaid(['o3']);
    expect(Number(db.itemRows.get('i3')!.commissionRate)).toBe(25);
  });

  it('honours override rates from the rates port', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    const ratesPort = rates(10, 5);
    await service(db, ratesPort).markCheckoutPaid(['o1']);
    expect(ratesPort.resolveCommissionRates).toHaveBeenCalledWith('brand-a');
    expect(Number(db.itemRows.get('i1')!.commissionRate)).toBe(10);
    expect(Number(db.itemRows.get('i1')!.lineSellerTotal)).toBe(900);
  });

  it('computes per-item commission with rounding and keeps the order totals consistent', async () => {
    const db = buildFakeDb(
      [order({ id: 'o1', sellerProfileId: 'sp-a', adminPriceTotal: new Decimal(33.35), sellerPriceTotal: new Decimal(33.35) })],
      [
        item({ id: 'i1', orderId: 'o1', quantity: 3, lineAdminTotal: new Decimal(10.01), unitAdminPrice: new Decimal(3.34) }),
        item({ id: 'i2', orderId: 'o1', quantity: 1, lineAdminTotal: new Decimal(23.34), unitAdminPrice: new Decimal(23.34) }),
      ],
    );
    await service(db, rates(17.5, 15)).markCheckoutPaid(['o1']);

    const net = Number(db.itemRows.get('i1')!.lineSellerTotal) + Number(db.itemRows.get('i2')!.lineSellerTotal);
    const commission = Number(db.itemRows.get('i1')!.commissionAmount) + Number(db.itemRows.get('i2')!.commissionAmount);
    expect(Math.round((net + commission) * 100)).toBe(3335);
    const o = db.rows.get('o1')!;
    expect(Number(o.sellerPriceTotal)).toBeCloseTo(net, 2);
    expect(Number(o.adminMargin)).toBeCloseTo(commission, 2);
  });

  it('curated sibling orders flip to PAYMENT_RECEIVED with no commission and no brand lock', async () => {
    const db = buildFakeDb([order({ id: 'cur' }), brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    const outcome = await service(db).markCheckoutPaid(['cur', 'o1']);

    expect(outcome.settledOrderIds.sort()).toEqual(['cur', 'o1']);
    expect(outcome.brandOrderIds).toEqual(['o1']);
    expect(db.rawRepo.lockBrand).toHaveBeenCalledTimes(1);
    expect(db.rows.get('cur')!.status).toBe(OrderStatus.PAYMENT_RECEIVED);
  });

  it('locks the brand row INSIDE the transaction and BEFORE counting other paid orders', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    await service(db).markCheckoutPaid(['o1']);

    expect(db.events).toEqual(['tx:begin', 'lock', 'count', 'tx:commit']);
    const lockOrder = db.rawRepo.lockBrand.mock.invocationCallOrder[0];
    const countOrder = db.rawRepo.countOtherPaidBrandOrders.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(countOrder);
  });

  it('two concurrent FIRST orders of the same brand cannot both get the first rate', async () => {
    const db = buildFakeDb(
      [brandOrder('o1'), brandOrder('o2')],
      [item({ id: 'i1', orderId: 'o1' }), item({ id: 'i2', orderId: 'o2' })],
    );
    const svc = service(db);

    await Promise.all([svc.markCheckoutPaid(['o1']), svc.markCheckoutPaid(['o2'])]);

    const rateList = [Number(db.itemRows.get('i1')!.commissionRate), Number(db.itemRows.get('i2')!.commissionRate)].sort();
    expect(rateList).toEqual([15, 25]);
  });

  it('is idempotent: settling an already-paid checkout changes nothing and notifies no one', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    const svc = service(db);
    await svc.markCheckoutPaid(['o1']);
    vi.mocked(notificationsService.notifyBrandNewOrder).mockClear();
    db.rawRepo.updateItemCommission.mockClear();

    const replay = await svc.markCheckoutPaid(['o1']);

    expect(replay).toEqual({ settledOrderIds: [], brandOrderIds: [] });
    expect(db.rawRepo.updateItemCommission).not.toHaveBeenCalled();
    expect(notificationsService.notifyBrandNewOrder).not.toHaveBeenCalled();
    expect(Number(db.itemRows.get('i1')!.commissionRate)).toBe(25); // first rate not recomputed as repeat
  });

  it('runs the payments hook inside the same transaction, before the orders are flipped', async () => {
    const db = buildFakeDb([order({ id: 'cur' })], []);
    const hook = vi.fn(async () => {
      expect(db.events).toEqual(['tx:begin']);
      expect(db.rows.get('cur')!.status).toBe(OrderStatus.PENDING_PAYMENT);
    });
    await service(db).markCheckoutPaid(['cur'], hook);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('notifies each brand AFTER the commit, and a notification failure never fails the settlement', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    vi.mocked(notificationsService.notifyBrandNewOrder).mockImplementation(async () => {
      expect(db.events).toContain('tx:commit');
      throw new Error('mail down');
    });

    await expect(service(db).markCheckoutPaid(['o1'])).resolves.toMatchObject({ brandOrderIds: ['o1'] });
    expect(notificationsService.notifyBrandNewOrder).toHaveBeenCalledWith('o1');
  });

  it('a failure while locking commission propagates (the whole transaction rolls back)', async () => {
    const db = buildFakeDb([brandOrder('o1')], [item({ id: 'i1', orderId: 'o1' })]);
    const failing: CommissionRatesPort = { resolveCommissionRates: vi.fn().mockRejectedValue(new Error('settings down')) };
    await expect(service(db, failing).markCheckoutPaid(['o1'])).rejects.toThrow('settings down');
    expect(notificationsService.notifyBrandNewOrder).not.toHaveBeenCalled();
  });

  it('legacy markPaymentReceived refuses brand orders', async () => {
    const repo = { findByIdRaw: vi.fn().mockResolvedValue(order({ sellerProfileId: 'sp-a' })), setStatus: vi.fn() } as unknown as OrdersRepository;
    const svc = new OrdersService(repo, {} as ProductsService, {} as BuyersService, {} as PayoutsService, rates());
    await expect(svc.markPaymentReceived('order-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });
});

// ── brand fulfilment ────────────────────────────────────────────────────

function brandRecord(overrides: Partial<BrandOrderRecord> = {}): BrandOrderRecord {
  return {
    ...order({ id: 'bo-1', sellerProfileId: 'sp-a', checkoutId: 'co-1', status: OrderStatus.PAYMENT_RECEIVED }),
    items: [
      {
        ...item({
          id: 'i1',
          orderId: 'bo-1',
          commissionRate: new Decimal(25),
          commissionAmount: new Decimal(250),
          lineSellerTotal: new Decimal(750),
        }),
        product: { name: 'Table Runner', images: [] },
        variant: null,
      },
    ],
    buyer: { contactName: 'Jane Buyer', phone: '+1 555 0100', companyName: 'Jane Co', country: 'US' },
    shippingAddress: {
      id: 'addr-1',
      buyerId: 'buyer-1',
      label: 'HQ',
      line1: '1 Main St',
      line2: null,
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  } as BrandOrderRecord;
}

describe('OrdersService brand fulfilment', () => {
  let repo: OrdersRepository;
  let payouts: PayoutsService;
  let service: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = {
      findBrandOrder: vi.fn(),
      listForBrand: vi.fn(),
      transitionIfStatus: vi.fn().mockResolvedValue(true),
    } as unknown as OrdersRepository;
    payouts = { createForDeliveredBrandOrder: vi.fn().mockResolvedValue(undefined) } as unknown as PayoutsService;
    service = new OrdersService(repo, {} as ProductsService, {} as BuyersService, payouts, {} as CommissionRatesPort);
  });

  it('brand view exposes buyer name/phone/address and the commission breakdown for its own order', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord());
    const view = await service.getForBrand('sp-a', 'bo-1');

    expect(view.buyer).toEqual({ name: 'Jane Buyer', company: 'Jane Co', phone: '+1 555 0100', country: 'US' });
    expect(view.shippingAddress).toMatchObject({ line1: '1 Main St', city: 'Austin', postalCode: '78701' });
    expect(view.items[0]).toMatchObject({ commissionRate: '25', commissionAmount: '250', lineNet: '750', lineGross: '1000' });
    expect(view.commissionTotal).toBe('250.00');
    expect(view.netTotal).toBe('750.00');
  });

  it('brand view hides internals (no buyer id/email, no admin margin)', () => {
    const view = toBrandOrderView(brandRecord());
    const json = JSON.stringify(view);
    expect(json).not.toContain('buyerId');
    expect(json).not.toContain('adminMargin');
    expect(view).not.toHaveProperty('buyerId');
  });

  it('ownership: brand A cannot read or move brand B\'s order', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ sellerProfileId: 'sp-b' }));

    await expect(service.getForBrand('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.brandConfirm('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.brandShip('sp-a', 'bo-1', 'TRK')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.brandDeliver('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.transitionIfStatus).not.toHaveBeenCalled();
    expect(payouts.createForDeliveredBrandOrder).not.toHaveBeenCalled();
  });

  it('a brand cannot touch a curated order (sellerProfileId null)', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ sellerProfileId: null }));
    await expect(service.brandConfirm('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('unpaid and missing orders are 404 for the brand', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValueOnce(brandRecord({ status: OrderStatus.PENDING_PAYMENT }));
    await expect(service.getForBrand('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(repo.findBrandOrder).mockResolvedValueOnce(null);
    await expect(service.getForBrand('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(repo.findBrandOrder).mockResolvedValueOnce(brandRecord({ deletedAt: new Date() }));
    await expect(service.getForBrand('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('confirm: PAYMENT_RECEIVED -> CONFIRMED, notifies the buyer', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord());
    await service.brandConfirm('sp-a', 'bo-1');

    expect(repo.transitionIfStatus).toHaveBeenCalledWith('bo-1', OrderStatus.PAYMENT_RECEIVED, OrderStatus.CONFIRMED, undefined);
    expect(notificationsService.notifyOrderStatusChanged).toHaveBeenCalledWith('buyer-user-1', 'bo-1', OrderStatus.CONFIRMED);
  });

  it('ship: CONFIRMED -> IN_TRANSIT stores the tracking number (with carrier when given)', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ status: OrderStatus.CONFIRMED }));
    await service.brandShip('sp-a', 'bo-1', 'TRK123', 'DHL');
    expect(repo.transitionIfStatus).toHaveBeenCalledWith('bo-1', OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, {
      trackingNumber: 'DHL: TRK123',
    });

    await service.brandShip('sp-a', 'bo-1', 'TRK456');
    expect(repo.transitionIfStatus).toHaveBeenLastCalledWith('bo-1', OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, {
      trackingNumber: 'TRK456',
    });
  });

  it('deliver: IN_TRANSIT -> DELIVERED then creates the brand payout', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ status: OrderStatus.IN_TRANSIT }));
    await service.brandDeliver('sp-a', 'bo-1');

    expect(repo.transitionIfStatus).toHaveBeenCalledWith('bo-1', OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, undefined);
    expect(payouts.createForDeliveredBrandOrder).toHaveBeenCalledWith('bo-1');
  });

  it('deliver still succeeds (and logs) if payout creation fails after the status change', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ status: OrderStatus.IN_TRANSIT }));
    vi.mocked(payouts.createForDeliveredBrandOrder).mockRejectedValue(new Error('db down'));
    await expect(service.brandDeliver('sp-a', 'bo-1')).resolves.toBeDefined();
  });

  it.each([
    ['confirm', OrderStatus.CONFIRMED, (s: OrdersService) => s.brandConfirm('sp-a', 'bo-1')],
    ['confirm', OrderStatus.DELIVERED, (s: OrdersService) => s.brandConfirm('sp-a', 'bo-1')],
    ['ship (skipping confirm)', OrderStatus.PAYMENT_RECEIVED, (s: OrdersService) => s.brandShip('sp-a', 'bo-1', 'T')],
    ['deliver (skipping ship)', OrderStatus.CONFIRMED, (s: OrdersService) => s.brandDeliver('sp-a', 'bo-1')],
    ['deliver (cancelled)', OrderStatus.CANCELLED, (s: OrdersService) => s.brandDeliver('sp-a', 'bo-1')],
  ])('rejects invalid transition: %s from %s', async (_label, status, act) => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ status }));
    await expect(act(service)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.transitionIfStatus).not.toHaveBeenCalled();
    expect(payouts.createForDeliveredBrandOrder).not.toHaveBeenCalled();
  });

  it('a concurrent status change (compare-and-set loses) is a 409 and creates no payout', async () => {
    vi.mocked(repo.findBrandOrder).mockResolvedValue(brandRecord({ status: OrderStatus.IN_TRANSIT }));
    vi.mocked(repo.transitionIfStatus).mockResolvedValue(false);
    await expect(service.brandDeliver('sp-a', 'bo-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(payouts.createForDeliveredBrandOrder).not.toHaveBeenCalled();
  });

  it('lists the brand\'s own orders through the repo, filtered by status', async () => {
    vi.mocked(repo.listForBrand).mockResolvedValue({ data: [brandRecord()], total: 1 });
    const { data, total } = await service.listForBrand('sp-a', OrderStatus.CONFIRMED, { page: 1, limit: 20 });
    expect(repo.listForBrand).toHaveBeenCalledWith('sp-a', OrderStatus.CONFIRMED, { page: 1, limit: 20 });
    expect(total).toBe(1);
    expect(data[0].buyer.name).toBe('Jane Buyer');
  });

  it('the admin pipeline refuses to drive a marketplace order', async () => {
    const adminRepo = { findByIdRaw: vi.fn().mockResolvedValue(order({ sellerProfileId: 'sp-a', status: OrderStatus.PAYMENT_RECEIVED })), setStatus: vi.fn() } as unknown as OrdersRepository;
    const svc = new OrdersService(adminRepo, {} as ProductsService, {} as BuyersService, payouts, {} as CommissionRatesPort);
    await expect(svc.confirmOrder('order-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(adminRepo.setStatus).not.toHaveBeenCalled();
  });
});

describe('buyer / curated seller projections with marketplace data', () => {
  it('buyer order view carries checkoutId, brand, item brand and tracking number', async () => {
    const repo = {
      findByIdWithItems: vi.fn().mockResolvedValue({
        ...order({ id: 'o1', buyerId: 'buyer-1', sellerProfileId: 'sp-a', checkoutId: 'co-1', trackingNumber: 'DHL: T1', status: OrderStatus.IN_TRANSIT }),
        sellerProfile: { brand: { name: 'Brand A', slug: 'brand-a' } },
        items: [
          {
            ...item(),
            product: {
              name: 'Runner',
              images: [],
              brand: { id: 'brand-a', name: 'Brand A', slug: 'brand-a', logoUrl: null, isVerified: true, minOrderValueInr: new Decimal(1000) },
            },
            variant: null,
            review: null,
          },
        ],
      }),
    } as unknown as OrdersRepository;
    const svc = new OrdersService(repo, {} as ProductsService, {} as BuyersService, {} as PayoutsService, {} as CommissionRatesPort);

    const view = await svc.getMyOrder('buyer-1', 'o1');

    expect(view.checkoutId).toBe('co-1');
    expect(view.brand).toEqual({ name: 'Brand A', slug: 'brand-a' });
    expect(view.trackingNumber).toBe('DHL: T1');
    expect(view.items[0].brand).toMatchObject({ slug: 'brand-a', isVerified: true, minOrderValueInr: 1000 });
    expect(view).not.toHaveProperty('sellerPriceTotal');
    expect(view).not.toHaveProperty('adminMargin');
    expect(JSON.stringify(view)).not.toContain('commission');
  });

  it('a curated order has brand = null and checkoutId carried through', async () => {
    const repo = {
      findByIdWithItems: vi.fn().mockResolvedValue({ ...order({ id: 'o1', buyerId: 'buyer-1', checkoutId: 'co-1' }), items: [] }),
    } as unknown as OrdersRepository;
    const svc = new OrdersService(repo, {} as ProductsService, {} as BuyersService, {} as PayoutsService, {} as CommissionRatesPort);
    const view = await svc.getMyOrder('buyer-1', 'o1');
    expect(view.brand).toBeNull();
    expect(view.checkoutId).toBe('co-1');
  });

  it('curated seller projection has no buyer info and no admin price', async () => {
    const repo = {
      listItemsForSeller: vi.fn().mockResolvedValue({
        data: [{ ...item({ sellerId: 'seller-1' }), product: { name: 'Runner' }, order: { status: OrderStatus.CONFIRMED, expectedCollectionDate: null } }],
        total: 1,
      }),
    } as unknown as OrdersRepository;
    const svc = new OrdersService(repo, {} as ProductsService, {} as BuyersService, {} as PayoutsService, {} as CommissionRatesPort);

    const { data } = await svc.listItemsForSeller('seller-1', { page: 1, limit: 20 });

    const json = JSON.stringify(data);
    for (const forbidden of ['buyer', 'phone', 'address', 'unitAdminPrice', 'lineAdminTotal', 'shipping']) {
      expect(json.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
