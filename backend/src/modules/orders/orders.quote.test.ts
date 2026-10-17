import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandStatus, ProductApprovalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../utils/errors';
import { ProductsService } from '../products/products.service';
import { ProductWithMedia } from '../products/products.types';
import { BuyersService } from '../buyers/buyers.service';
import { PayoutsService } from '../payouts/payouts.service';
import { OrdersRepository } from './orders.repository';
import { OrdersService, ITEMS_UNAVAILABLE } from './orders.service';
import { quoteSchema } from './orders.validation';

vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../config/prisma', () => ({ prisma: {} }));
vi.mock('../notifications/notifications.service', () => ({ notificationsService: {} }));

const PID = '11111111-1111-4111-8111-111111111111';
const VID = '22222222-2222-4222-8222-222222222222';
const VID2 = '33333333-3333-4333-8333-333333333333';

interface TierSpec {
  moq: number;
  admin: number | null;
  agent?: number | null;
  seller?: number;
}

const tier = (t: TierSpec, i: number) => ({
  id: `t${i}`,
  productId: PID,
  variantId: VID,
  moq: t.moq,
  sellerPrice: new Decimal(t.seller ?? 1),
  adminPrice: t.admin == null ? null : new Decimal(t.admin),
  agentPrice: t.agent == null ? null : new Decimal(t.agent),
});

function variant(id: string, status: 'ACTIVE' | 'INACTIVE', tiers: TierSpec[]) {
  return { id, productId: PID, type: 'Size', value: id, status, attributes: [], priceTiers: tiers.map(tier) };
}

function buildProduct(over: Record<string, unknown> = {}, flat: TierSpec[] = [], variants: unknown[] = []): ProductWithMedia {
  return {
    id: PID,
    sellerId: 'seller-1',
    brandId: null,
    name: 'Table Runner',
    moq: 10,
    sellerPrice: new Decimal(5),
    adminPrice: new Decimal(12),
    agentPrice: null,
    approvalStatus: ProductApprovalStatus.APPROVED,
    isPublished: true,
    deletedAt: null,
    images: [],
    videos: [],
    variants,
    priceTiers: flat.map(tier),
    ...over,
  } as unknown as ProductWithMedia;
}

describe('OrdersService quote + shared pricing core', () => {
  let repo: OrdersRepository;
  let products: ProductsService;
  let service: OrdersService;

  beforeEach(() => {
    repo = {
      findBrandsByIds: vi.fn().mockResolvedValue([]),
      findSellersOnVacation: vi.fn().mockResolvedValue(new Set()),
      createPending: vi.fn().mockImplementation(async (input: unknown) => ({ id: 'o1', items: [], input })),
    } as unknown as OrdersRepository;
    products = { getForCheckout: vi.fn() } as unknown as ProductsService;
    service = new OrdersService(
      repo,
      products,
      { verifyAddressOwnership: vi.fn() } as unknown as BuyersService,
      {} as unknown as PayoutsService,
    );
  });

  const give = (p: ProductWithMedia | null) => {
    if (p) vi.mocked(products.getForCheckout).mockResolvedValue(p);
    else vi.mocked(products.getForCheckout).mockRejectedValue(AppError.notFound('Product not found'));
  };

  describe('quote', () => {
    it('prices an OK line and sums the subtotal', async () => {
      give(buildProduct());
      const r = await service.quoteItems([{ productId: PID, quantity: 10 }, { productId: PID, quantity: 20 }], 'BUYER');
      expect(r.lines[0]).toEqual({
        productId: PID,
        variantId: null,
        quantity: 10,
        isSample: false,
        status: 'OK',
        unitPriceInr: 12,
        lineTotalInr: 120,
        moq: 10,
      });
      expect(r.subtotalInr).toBe(360);
    });

    it('subtotal excludes non-OK lines', async () => {
      give(buildProduct());
      const r = await service.quoteItems([{ productId: PID, quantity: 10 }, { productId: PID, quantity: 1 }], 'BUYER');
      expect(r.lines[1].status).toBe('BELOW_MOQ');
      expect(r.subtotalInr).toBe(120);
    });

    it('UNAVAILABLE for a missing, unpublished or unapproved product (never throws)', async () => {
      give(null);
      expect((await service.quoteItems([{ productId: PID, quantity: 1 }], 'BUYER')).lines[0]).toMatchObject({
        status: 'UNAVAILABLE',
        moq: 1,
      });
      give(buildProduct({ isPublished: false }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('UNAVAILABLE');
      give(buildProduct({ approvalStatus: ProductApprovalStatus.PENDING }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('UNAVAILABLE');
      give(buildProduct({ deletedAt: new Date() }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('UNAVAILABLE');
    });

    it('UNAVAILABLE for a suspended brand', async () => {
      give(buildProduct({ brandId: 'b1' }));
      vi.mocked(repo.findBrandsByIds).mockResolvedValue([{ id: 'b1', status: BrandStatus.SUSPENDED }] as never);
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('UNAVAILABLE');
    });

    it('brand product is OK for a buyer but UNAVAILABLE for an agent', async () => {
      give(buildProduct({ brandId: 'b1' }));
      vi.mocked(repo.findBrandsByIds).mockResolvedValue([{ id: 'b1', status: BrandStatus.ACTIVE }] as never);
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('OK');
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'AGENT')).lines[0].status).toBe('UNAVAILABLE');
    });

    it('OPTION_CHANGED for a variantId that no longer belongs to the product', async () => {
      give(buildProduct({}, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20 }])]));
      const r = await service.quoteItems([{ productId: PID, variantId: VID2, quantity: 10 }], 'BUYER');
      expect(r.lines[0]).toMatchObject({ status: 'OPTION_CHANGED', variantId: VID2 });
      expect(r.lines[0].unitPriceInr).toBeUndefined();
    });

    it('OPTION_CHANGED for an INACTIVE variant', async () => {
      give(buildProduct({}, [], [variant(VID, 'INACTIVE', [{ moq: 1, admin: 20 }]), variant(VID2, 'ACTIVE', [{ moq: 1, admin: 30 }])]));
      const r = await service.quoteItems([{ productId: PID, variantId: VID, quantity: 10 }], 'BUYER');
      expect(r.lines[0].status).toBe('OPTION_CHANGED');
      expect(r.lines[0].message).toBe('This option is no longer available');
    });

    it('CHOOSE_OPTION when the product has an ACTIVE variant but none was given', async () => {
      give(buildProduct({}, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20 }])]));
      const r = await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER');
      expect(r.lines[0]).toMatchObject({ status: 'CHOOSE_OPTION', moq: 10 });
      expect(r.subtotalInr).toBe(0);
    });

    it('only INACTIVE variants means no option is needed', async () => {
      give(buildProduct({}, [], [variant(VID, 'INACTIVE', [{ moq: 1, admin: 20 }])]));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('OK');
    });

    it('BELOW_MOQ reports the moq and no price', async () => {
      give(buildProduct({ moq: 24 }));
      const r = await service.quoteItems([{ productId: PID, quantity: 23 }], 'BUYER');
      expect(r.lines[0]).toMatchObject({ status: 'BELOW_MOQ', moq: 24 });
      expect(r.lines[0].unitPriceInr).toBeUndefined();
      expect(r.lines[0].lineTotalInr).toBeUndefined();
    });

    it('tier boundaries for a buyer', async () => {
      give(
        buildProduct({ moq: 1 }, [
          { moq: 10, admin: 12, agent: 10 },
          { moq: 50, admin: 9, agent: 7 },
          { moq: 100, admin: 8, agent: null },
        ]),
      );
      const unit = async (q: number) => (await service.quoteItems([{ productId: PID, quantity: q }], 'BUYER')).lines[0].unitPriceInr;
      expect(await unit(1)).toBe(12);
      expect(await unit(49)).toBe(12);
      expect(await unit(50)).toBe(9);
      expect(await unit(99)).toBe(9);
      expect(await unit(100)).toBe(8);
    });

    it('tier boundaries for an agent, with and without agentPrice', async () => {
      give(
        buildProduct({ moq: 1 }, [
          { moq: 10, admin: 12, agent: 10 },
          { moq: 50, admin: 9, agent: 7 },
          { moq: 100, admin: 8, agent: null },
        ]),
      );
      const unit = async (q: number) => (await service.quoteItems([{ productId: PID, quantity: q }], 'AGENT')).lines[0].unitPriceInr;
      expect(await unit(49)).toBe(10);
      expect(await unit(50)).toBe(7);
      expect(await unit(99)).toBe(7);
      // moq 100 tier has no agent price -> agent pays the buyer price (8)
      expect(await unit(100)).toBe(8);
    });

    it('variant tiers use the variant price and agent fallback', async () => {
      give(buildProduct({ moq: 1 }, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20, agent: 18 }, { moq: 10, admin: 15, agent: null }])]));
      const q = (role: 'BUYER' | 'AGENT', n: number) =>
        service.quoteItems([{ productId: PID, variantId: VID, quantity: n }], role).then((r) => r.lines[0].unitPriceInr);
      expect(await q('BUYER', 9)).toBe(20);
      expect(await q('BUYER', 10)).toBe(15);
      expect(await q('AGENT', 9)).toBe(18);
      expect(await q('AGENT', 10)).toBe(15);
    });

    it('agent with no agent price at product level pays the buyer price', async () => {
      give(buildProduct({ adminPrice: new Decimal(12), agentPrice: null }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'AGENT')).lines[0].unitPriceInr).toBe(12);
      give(buildProduct({ adminPrice: new Decimal(12), agentPrice: new Decimal(9) }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'AGENT')).lines[0].unitPriceInr).toBe(9);
    });

    it('a product with no usable price at all is reported UNAVAILABLE, not 0', async () => {
      give(buildProduct({ adminPrice: null }));
      expect((await service.quoteItems([{ productId: PID, quantity: 10 }], 'BUYER')).lines[0].status).toBe('UNAVAILABLE');
    });

    it('quote and checkout agree on price (shared core)', async () => {
      give(buildProduct({ moq: 1 }, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20 }, { moq: 5, admin: 17.5 }])]));
      const item = { productId: PID, variantId: VID, quantity: 7 };
      const quoted = (await service.quoteItems([item], 'BUYER')).lines[0];
      await service.createPendingCheckout('buyer-1', [item], undefined, 'BUYER');
      const charged = vi.mocked(repo.createPending).mock.calls[0][0].items[0];
      expect(charged.unitAdminPrice).toBe(quoted.unitPriceInr);
      expect(charged.lineAdminTotal).toBe(quoted.lineTotalInr);
    });
  });

  describe('quoteSchema', () => {
    const item = { productId: PID, quantity: 1 };
    it('accepts 1 to 100 items', () => {
      expect(quoteSchema.safeParse({ items: [item] }).success).toBe(true);
      expect(quoteSchema.safeParse({ items: Array(100).fill(item) }).success).toBe(true);
    });
    it('rejects 0 items, 101 items, bad uuid and quantity < 1', () => {
      expect(quoteSchema.safeParse({ items: [] }).success).toBe(false);
      expect(quoteSchema.safeParse({ items: Array(101).fill(item) }).success).toBe(false);
      expect(quoteSchema.safeParse({ items: [{ productId: 'x', quantity: 1 }] }).success).toBe(false);
      expect(quoteSchema.safeParse({ items: [{ productId: PID, quantity: 0 }] }).success).toBe(false);
      expect(quoteSchema.safeParse({ items: [{ productId: PID, variantId: 'x', quantity: 1 }] }).success).toBe(false);
    });
  });

  describe('checkout guard', () => {
    it('rejects a product with an ACTIVE variant and no variantId', async () => {
      give(buildProduct({}, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20 }])]));
      await expect(
        service.createPendingCheckout('buyer-1', [{ productId: PID, quantity: 10 }], undefined, 'BUYER'),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Choose an option for "Table Runner"' });
      expect(repo.createPending).not.toHaveBeenCalled();
    });

    it('rejects an INACTIVE variant', async () => {
      give(buildProduct({}, [], [variant(VID, 'INACTIVE', [{ moq: 1, admin: 20 }])]));
      await expect(
        service.createPendingCheckout('buyer-1', [{ productId: PID, variantId: VID, quantity: 10 }], undefined, 'BUYER'),
      ).rejects.toMatchObject({ statusCode: 400, message: 'This option is no longer available' });
    });

    it('keeps the foreign-variant message and ITEMS_UNAVAILABLE aggregation', async () => {
      give(buildProduct({}, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20 }])]));
      await expect(
        service.createPendingCheckout('buyer-1', [{ productId: PID, variantId: VID2, quantity: 10 }], undefined, 'BUYER'),
      ).rejects.toThrow(/does not belong to product/);

      give(buildProduct({ isPublished: false }));
      await expect(
        service.createPendingCheckout('buyer-1', [{ productId: PID, quantity: 10 }], undefined, 'BUYER'),
      ).rejects.toMatchObject({ details: { code: ITEMS_UNAVAILABLE, productIds: [PID] } });
    });

    it('charges an agent the buyer price on a variant tier without agentPrice', async () => {
      give(buildProduct({ moq: 1 }, [], [variant(VID, 'ACTIVE', [{ moq: 1, admin: 20, agent: null }])]));
      await service.createPendingCheckout('agent-1', [{ productId: PID, variantId: VID, quantity: 2 }], undefined, 'AGENT');
      expect(vi.mocked(repo.createPending).mock.calls[0][0].items[0].unitAdminPrice).toBe(20);
    });
  });
});
