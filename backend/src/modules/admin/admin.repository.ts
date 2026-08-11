import { OrderStatus, PayoutStatus, PrismaClient, ProductApprovalStatus, Role, SellerApplicationStatus, User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { DateRangeFilter } from './admin.types';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCURING,
  OrderStatus.COLLECTED,
  OrderStatus.IN_TRANSIT,
];

const REVENUE_COUNTING_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCURING,
  OrderStatus.COLLECTED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
];

function createdAtRange(range: DateRangeFilter) {
  if (!range.from && !range.to) return {};
  return { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } };
}

export class AdminRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  countPendingSellerApplications(): Promise<number> {
    return this.db.sellerApplication.count({
      where: { status: { in: [SellerApplicationStatus.PENDING, SellerApplicationStatus.MORE_INFO_REQUESTED] } },
    });
  }

  countPendingProductReviews(): Promise<number> {
    return this.db.product.count({
      where: {
        approvalStatus: { in: [ProductApprovalStatus.PENDING, ProductApprovalStatus.RESUBMITTED] },
        deletedAt: null,
      },
    });
  }

  countActiveOrders(): Promise<number> {
    return this.db.order.count({ where: { status: { in: ACTIVE_ORDER_STATUSES }, deletedAt: null } });
  }

  countOrdersAwaitingCollection(): Promise<number> {
    return this.db.order.count({ where: { status: OrderStatus.PROCURING, deletedAt: null } });
  }

  async pendingPayoutsSummary(): Promise<{ count: number; amount: number }> {
    const [count, sum] = await Promise.all([
      this.db.payout.count({ where: { status: PayoutStatus.PENDING } }),
      this.db.payout.aggregate({ where: { status: PayoutStatus.PENDING }, _sum: { amount: true } }),
    ]);
    return { count, amount: Number(sum._sum.amount ?? 0) };
  }

  async totalGMV(): Promise<number> {
    const result = await this.db.order.aggregate({
      where: { status: { in: REVENUE_COUNTING_STATUSES }, deletedAt: null },
      _sum: { adminPriceTotal: true },
    });
    return Number(result._sum.adminPriceTotal ?? 0);
  }

  countTotalBuyers(): Promise<number> {
    return this.db.buyerProfile.count({ where: { deletedAt: null } });
  }

  countTotalApprovedSellers(): Promise<number> {
    return this.db.sellerProfile.count({ where: { deletedAt: null } });
  }

  async revenueTotals(range: DateRangeFilter): Promise<{ gmv: number; adminMargin: number }> {
    const result = await this.db.order.aggregate({
      where: { status: { in: REVENUE_COUNTING_STATUSES }, deletedAt: null, ...createdAtRange(range) },
      _sum: { adminPriceTotal: true, adminMargin: true },
    });
    return {
      gmv: Number(result._sum.adminPriceTotal ?? 0),
      adminMargin: Number(result._sum.adminMargin ?? 0),
    };
  }

  async sellerPayoutsTotal(range: DateRangeFilter): Promise<number> {
    const where = range.from || range.to
      ? { status: PayoutStatus.PAID, paidAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
      : { status: PayoutStatus.PAID };
    const result = await this.db.payout.aggregate({ where, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
  }

  async ordersByStatus(range: DateRangeFilter): Promise<{ status: OrderStatus; count: number }[]> {
    const rows = await this.db.order.groupBy({
      by: ['status'],
      where: { deletedAt: null, ...createdAtRange(range) },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async ordersWithBuyerCountry(range: DateRangeFilter) {
    return this.db.order.findMany({
      where: { deletedAt: null, status: { in: REVENUE_COUNTING_STATUSES }, ...createdAtRange(range) },
      select: { adminPriceTotal: true, buyer: { select: { country: true } } },
    });
  }

  findActiveSellersWithBusinessName() {
    return this.db.sellerProfile.findMany({
      where: { deletedAt: null },
      select: { id: true, businessName: true },
    });
  }

  countApprovedProductsForSeller(sellerId: string): Promise<number> {
    return this.db.product.count({
      where: { sellerId, approvalStatus: ProductApprovalStatus.APPROVED, deletedAt: null },
    });
  }

  async distinctOrderCountForSeller(sellerId: string): Promise<number> {
    const rows = await this.db.orderItem.groupBy({ by: ['orderId'], where: { sellerId } });
    return rows.length;
  }

  async paidPayoutTotalForSeller(sellerId: string): Promise<number> {
    const result = await this.db.payout.aggregate({
      where: { sellerId, status: PayoutStatus.PAID },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async topProducts(limit: number) {
    const rows = await this.db.orderItem.groupBy({
      by: ['productId'],
      _count: { _all: true },
      _sum: { quantity: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const products = await this.db.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      productId: r.productId,
      name: nameById.get(r.productId) ?? 'Unknown product',
      ordersCount: r._count._all,
      unitsSold: r._sum.quantity ?? 0,
    }));
  }

  async orderItemsWithCategory() {
    return this.db.orderItem.findMany({
      select: {
        orderId: true,
        lineAdminTotal: true,
        product: { select: { categoryId: true, category: { select: { name: true } } } },
      },
    });
  }

  findAllCategoriesShallow() {
    return this.db.category.findMany({ select: { id: true, name: true, level: true } });
  }

  findAllCollectionsWithProductIds() {
    return this.db.collection.findMany({
      select: { id: true, name: true, products: { select: { productId: true } } },
    });
  }

  async orderItemsForProductIds(productIds: string[]) {
    if (productIds.length === 0) return [];
    return this.db.orderItem.findMany({
      where: { productId: { in: productIds } },
      select: { orderId: true, lineAdminTotal: true },
    });
  }

  findAuditLog(
    filter: { entityType?: string; adminId?: string },
    pagination: PaginationQuery,
  ) {
    const where = {
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.adminId ? { adminId: filter.adminId } : {}),
    };
    return Promise.all([
      this.db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.auditLog.count({ where }),
    ]);
  }

  findAllSettings() {
    return this.db.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsertSetting(key: string, value: unknown) {
    return this.db.platformSetting.upsert({
      where: { key },
      update: { value: value as never },
      create: { key, value: value as never },
    });
  }

  async findUsers(filter: { role?: Role }, pagination: PaginationQuery): Promise<{ data: User[]; total: number }> {
    const where = filter.role ? { role: filter.role } : {};
    const [data, total] = await Promise.all([
      this.db.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.user.count({ where }),
    ]);
    return { data, total };
  }

  findUserById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<User> {
    return this.db.user.update({ where: { id }, data: { status } });
  }

  promoteToAdmin(id: string): Promise<User> {
    return this.db.user.update({ where: { id }, data: { role: Role.SUPER_ADMIN } });
  }
}

export const adminRepository = new AdminRepository();
