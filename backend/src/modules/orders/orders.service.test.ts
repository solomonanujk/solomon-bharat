import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Order, OrderStatus, Product, ProductApprovalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductsService } from '../products/products.service';
import { ProductWithMedia } from '../products/products.types';
import { BuyersService } from '../buyers/buyers.service';
import { PayoutsService } from '../payouts/payouts.service';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrderWithItems } from './orders.types';

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/prisma', () => ({
  prisma: {
    buyerProfile: { findUnique: vi.fn().mockResolvedValue({ userId: 'buyer-user-1' }) },
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifyOrderStatusChanged: vi.fn().mockResolvedValue(undefined),
  },
}));

function buildProduct(overrides: Partial<Product> = {}): ProductWithMedia {
  const product: Product = {
    id: 'prod-1',
    sellerId: 'seller-1',
    categoryId: 'cat-1',
    name: 'Table Runner',
    slug: 'table-runner',
    description: 'desc',
    materials: 'Cotton',
    dimensions: null,
    weight: null,
    moq: 10,
    declaredStock: 100,
    sellerPrice: new Decimal(5),
    adminPrice: new Decimal(12),
    leadTime: null,
    approvalStatus: ProductApprovalStatus.APPROVED,
    rejectionReason: null,
    isPublished: true,
    isFeatured: false,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tags: [],
    stepQty: 1,
    isHandmade: false,
    placeOfOrigin: null,
    isGITagged: false,
    howItIsMade: null,
    artisanName: null,
    agentPrice: null,
    ...overrides,
  };
  return { ...product, images: [], variants: [], priceTiers: [] };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    shippingAddressId: null,
    status: OrderStatus.PAYMENT_RECEIVED,
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

function withItems(order: Order): OrderWithItems {
  return { ...order, items: [] };
}

function buildMockRepo(): OrdersRepository {
  return {
    findByIdWithItems: vi.fn(),
    findByIdRaw: vi.fn(),
    createPending: vi.fn(),
    setStatus: vi.fn(),
    setTrackingNumber: vi.fn(),
    setExportDocuments: vi.fn(),
    listForBuyer: vi.fn(),
    listForAdmin: vi.fn(),
    listItemsForSeller: vi.fn(),
  } as unknown as OrdersRepository;
}

function buildMockProducts(): ProductsService {
  return { getForCheckout: vi.fn() } as unknown as ProductsService;
}

function buildMockBuyers(): BuyersService {
  return { verifyAddressOwnership: vi.fn() } as unknown as BuyersService;
}

function buildMockPayouts(): PayoutsService {
  return { createForOrder: vi.fn().mockResolvedValue(undefined) } as unknown as PayoutsService;
}

describe('OrdersService', () => {
  let repo: OrdersRepository;
  let products: ProductsService;
  let buyers: BuyersService;
  let payouts: PayoutsService;
  let service: OrdersService;

  beforeEach(() => {
    repo = buildMockRepo();
    products = buildMockProducts();
    buyers = buildMockBuyers();
    payouts = buildMockPayouts();
    service = new OrdersService(repo, products, buyers, payouts);
  });

  describe('createPendingOrder', () => {
    it('rejects a quantity below the product MOQ', async () => {
      vi.mocked(products.getForCheckout).mockResolvedValue(buildProduct({ moq: 10 }));

      await expect(
        service.createPendingOrder('buyer-1', [{ productId: 'prod-1', quantity: 5 }], undefined, 'BUYER'),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.createPending).not.toHaveBeenCalled();
    });

    it('rejects a product that is not approved and published', async () => {
      vi.mocked(products.getForCheckout).mockResolvedValue(
        buildProduct({ approvalStatus: ProductApprovalStatus.PENDING, isPublished: false }),
      );

      await expect(
        service.createPendingOrder('buyer-1', [{ productId: 'prod-1', quantity: 10 }], undefined, 'BUYER'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('verifies shipping address ownership before creating the order', async () => {
      vi.mocked(products.getForCheckout).mockResolvedValue(buildProduct());
      vi.mocked(repo.createPending).mockResolvedValue(withItems(buildOrder()));

      await service.createPendingOrder('buyer-1', [{ productId: 'prod-1', quantity: 10 }], 'addr-1', 'BUYER');

      expect(buyers.verifyAddressOwnership).toHaveBeenCalledWith('buyer-1', 'addr-1');
    });

    it('computes correct totals and margin, and creates the order PENDING_PAYMENT', async () => {
      vi.mocked(products.getForCheckout).mockResolvedValue(buildProduct({ sellerPrice: new Decimal(5), adminPrice: new Decimal(12) }));
      vi.mocked(repo.createPending).mockResolvedValue(withItems(buildOrder()));

      await service.createPendingOrder('buyer-1', [{ productId: 'prod-1', quantity: 10 }], undefined, 'BUYER');

      expect(repo.createPending).toHaveBeenCalledWith(
        expect.objectContaining({
          adminPriceTotal: 120,
          sellerPriceTotal: 50,
          adminMargin: 70,
        }),
      );
    });
  });

  describe('markPaymentReceived', () => {
    it('rejects an order that is not awaiting payment', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.CONFIRMED }));

      await expect(service.markPaymentReceived('order-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('flips PENDING_PAYMENT to PAYMENT_RECEIVED', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PENDING_PAYMENT }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildOrder({ status: OrderStatus.PAYMENT_RECEIVED }));

      await service.markPaymentReceived('order-1');

      expect(repo.setStatus).toHaveBeenCalledWith('order-1', OrderStatus.PAYMENT_RECEIVED);
    });
  });

  describe('lifecycle sequencing', () => {
    it('rejects skipping a stage (PAYMENT_RECEIVED straight to PROCURING)', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PAYMENT_RECEIVED }));

      await expect(service.procureOrder('order-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.setStatus).not.toHaveBeenCalled();
    });

    it('allows the correct next stage', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PAYMENT_RECEIVED }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildOrder({ status: OrderStatus.CONFIRMED }));

      await service.confirmOrder('order-1', 'admin-1');

      expect(repo.setStatus).toHaveBeenCalledWith('order-1', OrderStatus.CONFIRMED, undefined);
    });

    it('rejects moving a delivered order any further', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.DELIVERED }));

      await expect(service.confirmOrder('order-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('collectOrder triggers payout creation for the seller(s) — goods are now owed regardless of transit outcome', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PROCURING }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildOrder({ status: OrderStatus.COLLECTED }));

      await service.collectOrder('order-1', 'admin-1');

      expect(payouts.createForOrder).toHaveBeenCalledWith('order-1');
    });
  });

  describe('cancelOrder', () => {
    it('allows cancelling while PAYMENT_RECEIVED', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PAYMENT_RECEIVED }));
      vi.mocked(repo.setStatus).mockResolvedValue(buildOrder({ status: OrderStatus.CANCELLED }));

      await service.cancelOrder('order-1', 'seller unavailable', 'admin-1');

      expect(repo.setStatus).toHaveBeenCalledWith('order-1', OrderStatus.CANCELLED, {
        cancelledReason: 'seller unavailable',
      });
    });

    it('blocks cancelling once procurement has started (PROCURING)', async () => {
      vi.mocked(repo.findByIdRaw).mockResolvedValue(buildOrder({ status: OrderStatus.PROCURING }));

      await expect(service.cancelOrder('order-1', 'changed mind', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('buyer/seller visibility', () => {
    it('rejects a buyer accessing another buyer\'s order', async () => {
      vi.mocked(repo.findByIdWithItems).mockResolvedValue(withItems(buildOrder({ buyerId: 'someone-else' })));

      await expect(service.getMyOrder('buyer-1', 'order-1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('buyer projection never includes sellerPriceTotal or adminMargin', async () => {
      vi.mocked(repo.findByIdWithItems).mockResolvedValue(withItems(buildOrder()));

      const order = await service.getMyOrder('buyer-1', 'order-1');

      expect(order).not.toHaveProperty('sellerPriceTotal');
      expect(order).not.toHaveProperty('adminMargin');
      expect(order.adminPriceTotal).toBe('120');
    });

    it('seller order item projection never includes buyer id or admin price', async () => {
      vi.mocked(repo.listItemsForSeller).mockResolvedValue({
        data: [
          {
            id: 'item-1',
            orderId: 'order-1',
            productId: 'prod-1',
            sellerId: 'seller-1',
            quantity: 10,
            unitAdminPrice: new Decimal(12),
            unitSellerPrice: new Decimal(5),
            lineAdminTotal: new Decimal(120),
            lineSellerTotal: new Decimal(50),
            createdAt: new Date(),
            product: { name: 'Table Runner' },
            order: { status: OrderStatus.CONFIRMED, expectedCollectionDate: null },
          },
        ],
        total: 1,
      } as never);

      const { data } = await service.listItemsForSeller('seller-1', { page: 1, limit: 20 });

      expect(data[0]).not.toHaveProperty('buyerId');
      expect(data[0]).not.toHaveProperty('unitAdminPrice');
      expect(data[0].sellerPrice).toBe('5');
    });
  });
});
