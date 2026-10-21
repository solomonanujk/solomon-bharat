import { Role, User } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { hashPassword } from '../../utils/bcrypt';
import { generateTempPassword } from '../../utils/helpers';
import { accountReadyEmailHtml } from '../../utils/emailTemplates';
import { mailProvider } from '../../providers/mail';
import { authService } from '../auth/auth.service';
import { toSafeUser, SafeUser } from '../../utils/safeUser';
import { PaginationQuery } from '../../utils/pagination';
import { AdminRepository, adminRepository } from './admin.repository';
import {
  CategoryPerformanceRow,
  CollectionPerformanceRow,
  DashboardSummary,
  DateRangeFilter,
  OrdersByCountryRow,
  OrdersByStatusRow,
  ProductPerformanceRow,
  ReportRow,
  ReportType,
  RevenueReport,
  SellerPerformanceRow,
} from './admin.types';

/**
 * How long a set-password link stays valid, for the copy the admin UI shows next to it.
 * Mirrors PASSWORD_SETUP_TTL_MS in auth.service (7 days) — stated as a literal rather than
 * imported, because importing a *value* from auth.service would make this module fail to
 * load in every test suite that mocks auth.service with just its methods.
 */
const PASSWORD_SETUP_TTL_DAYS = 7;

function toCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return '';
  const records = rows as unknown as Record<string, unknown>[];
  const headers = Object.keys(records[0]);
  const lines = [headers.join(',')];
  for (const row of records) {
    const values = headers.map((h) => {
      const value = row[h];
      const str =
        value === undefined || value === null
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

export class AdminService {
  constructor(private readonly repo: AdminRepository = adminRepository) {}

  async getDashboard(): Promise<DashboardSummary> {
    const [
      pendingSellerApplications,
      pendingProductReviews,
      activeOrders,
      ordersAwaitingCollection,
      pendingPayouts,
      totalGMV,
      totalBuyers,
      totalApprovedSellers,
      checkoutsAwaitingPayment,
      newRfqs,
      refundsToApprove,
    ] = await Promise.all([
      this.repo.countPendingSellerApplications(),
      this.repo.countPendingProductReviews(),
      this.repo.countActiveOrders(),
      this.repo.countOrdersAwaitingCollection(),
      this.repo.pendingPayoutsSummary(),
      this.repo.totalGMV(),
      this.repo.countTotalBuyers(),
      this.repo.countTotalApprovedSellers(),
      this.repo.countCheckoutsAwaitingPayment(),
      this.repo.countNewRfqs(),
      this.repo.countRefundsToApprove(),
    ]);

    return {
      checkoutsAwaitingPayment,
      newRfqs,
      refundsToApprove,
      pendingSellerApplications,
      pendingProductReviews,
      activeOrders,
      ordersAwaitingCollection,
      pendingPayoutsCount: pendingPayouts.count,
      pendingPayoutsAmount: pendingPayouts.amount.toFixed(2),
      totalGMV: totalGMV.toFixed(2),
      totalBuyers,
      totalApprovedSellers,
    };
  }

  private async revenueReport(range: DateRangeFilter): Promise<RevenueReport[]> {
    const [{ gmv, adminMargin }, sellerPayouts] = await Promise.all([
      this.repo.revenueTotals(range),
      this.repo.sellerPayoutsTotal(range),
    ]);
    return [
      {
        gmv: gmv.toFixed(2),
        adminMargin: adminMargin.toFixed(2),
        sellerPayouts: sellerPayouts.toFixed(2),
      },
    ];
  }

  private async ordersByStatusReport(range: DateRangeFilter): Promise<OrdersByStatusRow[]> {
    const rows = await this.repo.ordersByStatus(range);
    return rows.map((r) => ({ status: r.status, count: r.count }));
  }

  private async ordersByCountryReport(range: DateRangeFilter): Promise<OrdersByCountryRow[]> {
    const orders = await this.repo.ordersWithBuyerCountry(range);
    const byCountry = new Map<string, { count: number; gmv: number }>();
    for (const order of orders) {
      const country = order.buyer.country;
      const entry = byCountry.get(country) ?? { count: 0, gmv: 0 };
      entry.count += 1;
      entry.gmv += Number(order.adminPriceTotal);
      byCountry.set(country, entry);
    }
    return Array.from(byCountry.entries())
      .map(([country, { count, gmv }]) => ({ country, count, gmv: gmv.toFixed(2) }))
      .sort((a, b) => b.count - a.count);
  }

  private async sellersPerformanceReport(): Promise<SellerPerformanceRow[]> {
    const sellers = await this.repo.findActiveSellersWithBusinessName();
    return Promise.all(
      sellers.map(async (seller) => {
        const [approvedProducts, ordersCount, totalPayout] = await Promise.all([
          this.repo.countApprovedProductsForSeller(seller.id),
          this.repo.distinctOrderCountForSeller(seller.id),
          this.repo.paidPayoutTotalForSeller(seller.id),
        ]);
        return {
          sellerId: seller.id,
          businessName: seller.businessName,
          approvedProducts,
          ordersCount,
          totalPayout: totalPayout.toFixed(2),
        };
      }),
    );
  }

  private async productsPerformanceReport(): Promise<ProductPerformanceRow[]> {
    return this.repo.topProducts(50);
  }

  private async categoriesPerformanceReport(): Promise<CategoryPerformanceRow[]> {
    const [items, categories] = await Promise.all([
      this.repo.orderItemsWithCategory(),
      this.repo.findAllCategoriesShallow(),
    ]);

    const byCategory = new Map<string, { name: string; orderIds: Set<string>; gmv: number }>();
    for (const item of items) {
      const categoryId = item.product.categoryId;
      const entry = byCategory.get(categoryId) ?? {
        name: item.product.category.name,
        orderIds: new Set<string>(),
        gmv: 0,
      };
      entry.orderIds.add(item.orderId);
      entry.gmv += Number(item.lineAdminTotal);
      byCategory.set(categoryId, entry);
    }

    void categories; // available for future zero-order category rows if needed
    return Array.from(byCategory.entries())
      .map(([categoryId, { name, orderIds, gmv }]) => ({
        categoryId,
        name,
        ordersCount: orderIds.size,
        gmv: gmv.toFixed(2),
      }))
      .sort((a, b) => Number(b.gmv) - Number(a.gmv));
  }

  private async collectionsPerformanceReport(): Promise<CollectionPerformanceRow[]> {
    const collections = await this.repo.findAllCollectionsWithProductIds();
    return Promise.all(
      collections.map(async (collection) => {
        const productIds = collection.products.map((p) => p.productId);
        const items = await this.repo.orderItemsForProductIds(productIds);
        const orderIds = new Set(items.map((i) => i.orderId));
        const gmv = items.reduce((sum, i) => sum + Number(i.lineAdminTotal), 0);
        return {
          collectionId: collection.id,
          name: collection.name,
          ordersCount: orderIds.size,
          gmv: gmv.toFixed(2),
        };
      }),
    );
  }

  async getReport(type: ReportType, range: DateRangeFilter): Promise<ReportRow[]> {
    switch (type) {
      case 'revenue':
        return this.revenueReport(range);
      case 'orders-by-status':
        return this.ordersByStatusReport(range);
      case 'orders-by-country':
        return this.ordersByCountryReport(range);
      case 'sellers-performance':
        return this.sellersPerformanceReport();
      case 'products-performance':
        return this.productsPerformanceReport();
      case 'categories-performance':
        return this.categoriesPerformanceReport();
      case 'collections-performance':
        return this.collectionsPerformanceReport();
      default:
        throw AppError.badRequest(`Unknown report type: ${type as string}`);
    }
  }

  async getReportAsCsv(type: ReportType, range: DateRangeFilter): Promise<string> {
    const rows = await this.getReport(type, range);
    return toCsv(rows);
  }

  async getAuditLog(filter: { entityType?: string; adminId?: string; entityId?: string }, pagination: PaginationQuery) {
    const [data, total] = await this.repo.findAuditLog(filter, pagination);
    return { data, total };
  }

  async listSettings() {
    return this.repo.findAllSettings();
  }

  async upsertSetting(key: string, value: unknown) {
    return this.repo.upsertSetting(key, value);
  }

  async listUsers(filter: { role?: Role }, pagination: PaginationQuery): Promise<{ data: SafeUser[]; total: number }> {
    const { data, total } = await this.repo.findUsers(filter, pagination);
    return { data: data.map(toSafeUser), total };
  }

  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.repo.findUserById(id);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  }

  async suspendUser(id: string, adminId: string): Promise<SafeUser> {
    if (id === adminId) {
      throw AppError.badRequest('You cannot suspend your own account');
    }
    await this.getUserOrThrow(id);
    const updated = await this.repo.setUserStatus(id, 'SUSPENDED');
    await writeAuditLog(adminId, 'USER_SUSPENDED', 'User', id);
    return toSafeUser(updated);
  }

  async reactivateUser(id: string, adminId: string): Promise<SafeUser> {
    await this.getUserOrThrow(id);
    const updated = await this.repo.setUserStatus(id, 'ACTIVE');
    await writeAuditLog(adminId, 'USER_REACTIVATED', 'User', id);
    return toSafeUser(updated);
  }

  // ─── Seller / agent sign-in access (Admin → Sellers "Seller access" card) ────
  //
  // The owner wants to be able to re-share a seller's sign-in details at any time.
  // Passwords are bcrypt hashes and stay that way: nothing here can read an existing
  // password. Instead an admin can hand out a fresh one-time set-password link, or
  // mint a brand-new temporary password which is returned exactly once, in the HTTP
  // response body only — never stored in plaintext, never written to an audit log.

  /** Only accounts that actually sign in to a portal have "sign-in details" to share. */
  private static readonly ACCESS_MANAGED_ROLES: Role[] = [Role.SELLER, Role.AGENT];

  private async getAccessManagedUserOrThrow(id: string): Promise<User> {
    const user = await this.getUserOrThrow(id);
    if (!AdminService.ACCESS_MANAGED_ROLES.includes(user.role)) {
      throw AppError.badRequest('Sign-in details can only be managed for seller and agent accounts');
    }
    return user;
  }

  /**
   * Mints a fresh one-time "set your password" link the admin can paste into
   * WhatsApp/email. Only the token's hash is stored (see authService); the link works
   * once and expires after 7 days.
   */
  async createSignInLinkForUser(
    id: string,
    adminId: string,
  ): Promise<{ email: string; url: string; expiresInDays: number }> {
    const user = await this.getAccessManagedUserOrThrow(id);
    const url = await authService.createPasswordSetupUrl(user.id);
    // The URL carries the one-time secret, so only the fact that a link was issued is logged.
    await writeAuditLog(adminId, 'USER_SIGNIN_LINK_ISSUED', 'User', id, { email: user.email, role: user.role });
    return { email: user.email, url, expiresInDays: PASSWORD_SETUP_TTL_DAYS };
  }

  /**
   * Sets a brand-new temporary password on the account and returns the plaintext ONCE
   * so the admin can share it. The account is flagged mustChangePassword, every existing
   * session is revoked, and the seller also gets the normal "set your password" email.
   */
  async resetTemporaryPassword(
    id: string,
    adminId: string,
  ): Promise<{ email: string; tempPassword: string; emailSent: boolean }> {
    const user = await this.getAccessManagedUserOrThrow(id);

    const tempPassword = generateTempPassword();
    await this.repo.setUserPasswordHash(user.id, await hashPassword(tempPassword));
    await this.repo.revokeRefreshTokensForUser(user.id);

    // Deliberately no tempPassword in the metadata — the audit trail records that a
    // reset happened and by whom, never the secret itself.
    await writeAuditLog(adminId, 'USER_TEMP_PASSWORD_RESET', 'User', id, { email: user.email, role: user.role });

    const setupUrl = await authService.createPasswordSetupUrl(user.id);
    let emailSent = true;
    try {
      await mailProvider.sendMail({
        to: user.email,
        subject: 'Set your password and sign in to Solomon Bharat',
        html: accountReadyEmailHtml({
          intro: 'An administrator has reset the password on your Solomon Bharat account.',
          email: user.email,
          tempPassword,
          setupUrl,
          signInUrl: env.APP_URL,
        }),
      });
    } catch {
      // The admin already has the password to share by hand — a mail outage must not
      // lose it by failing the request after the reset has been committed.
      emailSent = false;
    }

    return { email: user.email, tempPassword, emailSent };
  }

  async promoteToAdmin(id: string, adminId: string): Promise<SafeUser> {
    const user = await this.getUserOrThrow(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw AppError.badRequest('User is already a SUPER_ADMIN');
    }
    const updated = await this.repo.promoteToAdmin(id);
    await writeAuditLog(adminId, 'USER_PROMOTED_TO_ADMIN', 'User', id);
    return toSafeUser(updated);
  }
}

export const adminService = new AdminService();
