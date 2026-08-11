import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, User, UserStatus } from '@prisma/client';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'someone@example.com',
    passwordHash: 'hash',
    role: Role.BUYER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): AdminRepository {
  return {
    countPendingSellerApplications: vi.fn(),
    countPendingProductReviews: vi.fn(),
    countActiveOrders: vi.fn(),
    countOrdersAwaitingCollection: vi.fn(),
    pendingPayoutsSummary: vi.fn(),
    totalGMV: vi.fn(),
    countTotalBuyers: vi.fn(),
    countTotalApprovedSellers: vi.fn(),
    revenueTotals: vi.fn(),
    sellerPayoutsTotal: vi.fn(),
    ordersByStatus: vi.fn(),
    ordersWithBuyerCountry: vi.fn(),
    findActiveSellersWithBusinessName: vi.fn(),
    countApprovedProductsForSeller: vi.fn(),
    distinctOrderCountForSeller: vi.fn(),
    paidPayoutTotalForSeller: vi.fn(),
    topProducts: vi.fn(),
    orderItemsWithCategory: vi.fn(),
    findAllCategoriesShallow: vi.fn(),
    findAllCollectionsWithProductIds: vi.fn(),
    orderItemsForProductIds: vi.fn(),
    findAuditLog: vi.fn(),
    findAllSettings: vi.fn(),
    upsertSetting: vi.fn(),
    findUsers: vi.fn(),
    findUserById: vi.fn(),
    setUserStatus: vi.fn(),
    promoteToAdmin: vi.fn(),
  } as unknown as AdminRepository;
}

describe('AdminService', () => {
  let repo: AdminRepository;
  let service: AdminService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new AdminService(repo);
  });

  describe('getDashboard', () => {
    it('assembles the full KPI summary from every source', async () => {
      vi.mocked(repo.countPendingSellerApplications).mockResolvedValue(3);
      vi.mocked(repo.countPendingProductReviews).mockResolvedValue(5);
      vi.mocked(repo.countActiveOrders).mockResolvedValue(10);
      vi.mocked(repo.countOrdersAwaitingCollection).mockResolvedValue(2);
      vi.mocked(repo.pendingPayoutsSummary).mockResolvedValue({ count: 4, amount: 250.5 });
      vi.mocked(repo.totalGMV).mockResolvedValue(10000);
      vi.mocked(repo.countTotalBuyers).mockResolvedValue(50);
      vi.mocked(repo.countTotalApprovedSellers).mockResolvedValue(20);

      const summary = await service.getDashboard();

      expect(summary).toEqual({
        pendingSellerApplications: 3,
        pendingProductReviews: 5,
        activeOrders: 10,
        ordersAwaitingCollection: 2,
        pendingPayoutsCount: 4,
        pendingPayoutsAmount: '250.50',
        totalGMV: '10000.00',
        totalBuyers: 50,
        totalApprovedSellers: 20,
      });
    });
  });

  describe('getReport', () => {
    it('rejects an unrecognized report type', async () => {
      // @ts-expect-error intentionally invalid type to verify the runtime guard
      await expect(service.getReport('not-a-real-report', {})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('orders-by-country aggregates by buyer country, not by order', async () => {
      vi.mocked(repo.ordersWithBuyerCountry).mockResolvedValue([
        { adminPriceTotal: 100 as never, buyer: { country: 'UK' } },
        { adminPriceTotal: 50 as never, buyer: { country: 'UK' } },
        { adminPriceTotal: 200 as never, buyer: { country: 'US' } },
      ]);

      const rows = await service.getReport('orders-by-country', {});

      expect(rows).toEqual([
        { country: 'UK', count: 2, gmv: '150.00' },
        { country: 'US', count: 1, gmv: '200.00' },
      ]);
    });

    it('revenue combines order totals with seller payouts for the period', async () => {
      vi.mocked(repo.revenueTotals).mockResolvedValue({ gmv: 1000, adminMargin: 400 });
      vi.mocked(repo.sellerPayoutsTotal).mockResolvedValue(600);

      const rows = await service.getReport('revenue', {});

      expect(rows).toEqual([{ gmv: '1000.00', adminMargin: '400.00', sellerPayouts: '600.00' }]);
    });

    it('orders-by-status passes each grouped row through unchanged', async () => {
      vi.mocked(repo.ordersByStatus).mockResolvedValue([
        { status: 'DELIVERED' as never, count: 5 },
        { status: 'CANCELLED' as never, count: 1 },
      ]);

      const rows = await service.getReport('orders-by-status', {});

      expect(rows).toEqual([
        { status: 'DELIVERED', count: 5 },
        { status: 'CANCELLED', count: 1 },
      ]);
    });

    it('sellers-performance combines product/order/payout counts per seller', async () => {
      vi.mocked(repo.findActiveSellersWithBusinessName).mockResolvedValue([
        { id: 'seller-1', businessName: 'Jaipur Handicrafts' },
      ]);
      vi.mocked(repo.countApprovedProductsForSeller).mockResolvedValue(4);
      vi.mocked(repo.distinctOrderCountForSeller).mockResolvedValue(9);
      vi.mocked(repo.paidPayoutTotalForSeller).mockResolvedValue(1200);

      const rows = await service.getReport('sellers-performance', {});

      expect(rows).toEqual([
        {
          sellerId: 'seller-1',
          businessName: 'Jaipur Handicrafts',
          approvedProducts: 4,
          ordersCount: 9,
          totalPayout: '1200.00',
        },
      ]);
    });

    it('products-performance delegates straight to the repository top-products query', async () => {
      vi.mocked(repo.topProducts).mockResolvedValue([
        { productId: 'prod-1', name: 'Table Runner', ordersCount: 3, unitsSold: 30 },
      ]);

      const rows = await service.getReport('products-performance', {});

      expect(repo.topProducts).toHaveBeenCalledWith(50);
      expect(rows).toEqual([{ productId: 'prod-1', name: 'Table Runner', ordersCount: 3, unitsSold: 30 }]);
    });

    it('categories-performance aggregates order items by category, counting distinct orders', async () => {
      vi.mocked(repo.orderItemsWithCategory).mockResolvedValue([
        { orderId: 'order-1', lineAdminTotal: 100 as never, product: { categoryId: 'cat-1', category: { name: 'Textiles' } } },
        { orderId: 'order-1', lineAdminTotal: 50 as never, product: { categoryId: 'cat-1', category: { name: 'Textiles' } } },
        { orderId: 'order-2', lineAdminTotal: 200 as never, product: { categoryId: 'cat-2', category: { name: 'Kitchenware' } } },
      ] as never);
      vi.mocked(repo.findAllCategoriesShallow).mockResolvedValue([]);

      const rows = await service.getReport('categories-performance', {});

      expect(rows).toEqual([
        { categoryId: 'cat-2', name: 'Kitchenware', ordersCount: 1, gmv: '200.00' },
        { categoryId: 'cat-1', name: 'Textiles', ordersCount: 1, gmv: '150.00' },
      ]);
    });

    it('collections-performance sums GMV only across each collection\'s own member products', async () => {
      vi.mocked(repo.findAllCollectionsWithProductIds).mockResolvedValue([
        { id: 'col-1', name: 'Sustainable Living', products: [{ productId: 'prod-1' }] },
      ] as never);
      vi.mocked(repo.orderItemsForProductIds).mockResolvedValue([
        { orderId: 'order-1', lineAdminTotal: 75 as never },
      ]);

      const rows = await service.getReport('collections-performance', {});

      expect(repo.orderItemsForProductIds).toHaveBeenCalledWith(['prod-1']);
      expect(rows).toEqual([{ collectionId: 'col-1', name: 'Sustainable Living', ordersCount: 1, gmv: '75.00' }]);
    });
  });

  describe('getReportAsCsv', () => {
    it('renders rows as a CSV with a header row', async () => {
      vi.mocked(repo.ordersByStatus).mockResolvedValue([{ status: 'DELIVERED' as never, count: 5 }]);

      const csv = await service.getReportAsCsv('orders-by-status', {});

      expect(csv).toBe('status,count\nDELIVERED,5');
    });

    it('returns an empty string when there are no rows', async () => {
      vi.mocked(repo.ordersByStatus).mockResolvedValue([]);

      const csv = await service.getReportAsCsv('orders-by-status', {});

      expect(csv).toBe('');
    });
  });

  describe('audit log, settings, and users listing', () => {
    it('getAuditLog passes filter and pagination through to the repository', async () => {
      vi.mocked(repo.findAuditLog).mockResolvedValue([[], 0]);

      await service.getAuditLog({ entityType: 'Order' }, { page: 1, limit: 20 });

      expect(repo.findAuditLog).toHaveBeenCalledWith({ entityType: 'Order' }, { page: 1, limit: 20 });
    });

    it('upsertSetting delegates to the repository', async () => {
      vi.mocked(repo.upsertSetting).mockResolvedValue({ key: 'site_name', value: 'Solomon Bharat', updatedAt: new Date() });

      await service.upsertSetting('site_name', 'Solomon Bharat');

      expect(repo.upsertSetting).toHaveBeenCalledWith('site_name', 'Solomon Bharat');
    });

    it('listUsers never leaks passwordHash through the SafeUser projection', async () => {
      vi.mocked(repo.findUsers).mockResolvedValue({ data: [buildUser()], total: 1 });

      const { data } = await service.listUsers({}, { page: 1, limit: 20 });

      expect(data[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('reactivateUser', () => {
    it('rejects reactivating a user that does not exist', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(null);

      await expect(service.reactivateUser('missing', 'admin-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('reactivates a suspended user', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser({ status: UserStatus.SUSPENDED }));
      vi.mocked(repo.setUserStatus).mockResolvedValue(buildUser({ status: UserStatus.ACTIVE }));

      const result = await service.reactivateUser('user-1', 'admin-1');

      expect(repo.setUserStatus).toHaveBeenCalledWith('user-1', 'ACTIVE');
      expect(result.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('user management', () => {
    it('rejects an admin suspending their own account', async () => {
      await expect(service.suspendUser('admin-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.setUserStatus).not.toHaveBeenCalled();
    });

    it('rejects promoting a user who is already SUPER_ADMIN', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser({ role: Role.SUPER_ADMIN }));

      await expect(service.promoteToAdmin('user-1', 'admin-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.promoteToAdmin).not.toHaveBeenCalled();
    });

    it('promotes an eligible user and audit-logs it', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser({ role: Role.BUYER }));
      vi.mocked(repo.promoteToAdmin).mockResolvedValue(buildUser({ role: Role.SUPER_ADMIN }));

      const result = await service.promoteToAdmin('user-1', 'admin-1');

      expect(result.role).toBe(Role.SUPER_ADMIN);
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
