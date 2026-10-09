import { Payout, PayoutStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { PaginationQuery } from '../../utils/pagination';
import { prisma } from '../../config/prisma';
import { notificationsService } from '../notifications/notifications.service';
import { PayoutsRepository, payoutsRepository } from './payouts.repository';
import { BrandSalesStats, PayoutListFilter, SellerPayoutSummary } from './payouts.types';

type DecimalLike = { toString(): string };

const toStr = (v: DecimalLike | null | undefined): string | null => (v === null || v === undefined ? null : v.toString());

/** Serialises Decimal money + breakdown fields (null for curated payouts). */
function serializePayout<T extends Payout>(p: T) {
  return {
    ...p,
    amount: p.amount.toString(),
    grossAmount: toStr(p.grossAmount),
    commissionRate: toStr(p.commissionRate),
    commissionAmount: toStr(p.commissionAmount),
  };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export class PayoutsService {
  constructor(private readonly repo: PayoutsRepository = payoutsRepository) {}

  private async getByIdOrThrow(id: string): Promise<Payout> {
    const payout = await this.repo.findById(id);
    if (!payout) {
      throw AppError.notFound('Payout not found');
    }
    return payout;
  }

  /**
   * Called by the orders module when an order moves to COLLECTED — Solomon Bharat owes the
   * seller as soon as goods are physically taken, independent of what happens after in transit.
   * Guarded against double-creation in case collection somehow fires twice for the same order.
   */
  async createForOrder(orderId: string): Promise<void> {
    const alreadyExists = await this.repo.existsForOrder(orderId);
    if (alreadyExists) return;
    await this.repo.createManyForOrder(orderId);
  }

  /**
   * Called when a marketplace brand marks its order DELIVERED. One PENDING payout per item:
   * amount = net (lineSellerTotal, i.e. gross - commission), with gross/rate/commission recorded.
   * Idempotent; non-brand orders are ignored so curated payouts stay on the COLLECTED path.
   * Record creation only - no transfer is initiated (payouts stay manual).
   */
  async createForDeliveredBrandOrder(orderId: string): Promise<void> {
    const order = await this.repo.findOrderForPayout(orderId);
    if (!order || !order.sellerProfileId) return;
    if (await this.repo.existsForOrder(orderId)) return;
    await this.repo.createManyForBrandOrder(orderId);
  }

  /** Sales dashboard numbers for a marketplace brand (paid, non-cancelled orders only). */
  async getBrandSalesStats(sellerProfileId: string): Promise<BrandSalesStats> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);

    const [orders, items, pendingPayout, recentOrders] = await Promise.all([
      this.repo.findPaidOrdersForBrand(sellerProfileId),
      this.repo.findPaidItemsForBrand(sellerProfileId),
      this.repo.sumForSeller(sellerProfileId, PayoutStatus.PENDING),
      this.repo.findPaidOrdersForBrand(sellerProfileId, since),
    ]);

    const gmv = orders.reduce((sum, o) => sum + Number(o.adminPriceTotal), 0);
    const commissionPaid = items.reduce((sum, i) => sum + Number(i.commissionAmount ?? 0), 0);
    const netEarned = items.reduce((sum, i) => sum + Number(i.lineSellerTotal), 0);

    const byProduct = new Map<string, { productId: string; name: string; units: number; revenue: number }>();
    for (const item of items) {
      const entry = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        units: 0,
        revenue: 0,
      };
      entry.units += item.quantity;
      entry.revenue += Number(item.lineAdminTotal);
      byProduct.set(item.productId, entry);
    }
    const topProducts = Array.from(byProduct.values())
      .map((p) => ({ ...p, revenue: round2(p.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const days = new Map<string, { date: string; orders: number; gmv: number }>();
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.set(key, { date: key, orders: 0, gmv: 0 });
    }
    for (const o of recentOrders) {
      const bucket = days.get(o.createdAt.toISOString().slice(0, 10));
      if (bucket) {
        bucket.orders += 1;
        bucket.gmv += Number(o.adminPriceTotal);
      }
    }

    return {
      ordersCount: orders.length,
      gmv: round2(gmv),
      commissionPaid: round2(commissionPaid),
      netEarned: round2(netEarned),
      pendingPayout: round2(pendingPayout),
      topProducts,
      last30Days: Array.from(days.values()).map((d) => ({ ...d, gmv: round2(d.gmv) })),
    };
  }

  async markAsPaid(id: string, notes: string | undefined, adminId: string): Promise<Payout> {
    const payout = await this.getByIdOrThrow(id);
    if (payout.status === PayoutStatus.PAID) {
      throw AppError.badRequest('Payout has already been marked as paid');
    }

    const updated = await this.repo.markPaid(id, notes);
    await writeAuditLog(adminId, 'PAYOUT_MARKED_PAID', 'Payout', id, { amount: payout.amount.toString() });

    const seller = await prisma.sellerProfile.findUnique({
      where: { id: payout.sellerId },
      select: { userId: true },
    });
    if (seller) {
      await notificationsService.notifyPayoutPaid(seller.userId, payout.amount.toString());
    }

    return updated;
  }

  async addNotes(id: string, notes: string): Promise<Payout> {
    await this.getByIdOrThrow(id);
    return this.repo.setNotes(id, notes);
  }

  async listForSeller(sellerId: string, filter: PayoutListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findForSeller(sellerId, filter, pagination);
    return { data: data.map((p) => serializePayout(p)), total };
  }

  async getSellerSummary(sellerId: string): Promise<SellerPayoutSummary> {
    const [totalEarned, pendingPayout, lastPayout] = await Promise.all([
      this.repo.sumForSeller(sellerId, PayoutStatus.PAID),
      this.repo.sumForSeller(sellerId, PayoutStatus.PENDING),
      this.repo.findLastPaidForSeller(sellerId),
    ]);

    const last = lastPayout && lastPayout.paidAt ? { amount: lastPayout.amount.toString(), paidAt: lastPayout.paidAt } : null;
    return {
      totalEarned: totalEarned.toFixed(2),
      pendingPayout: pendingPayout.toFixed(2),
      lastPayout: last,
      lastPayoutAmount: last ? last.amount : null,
      lastPayoutDate: last ? last.paidAt : null,
    };
  }

  async listForAdmin(filter: PayoutListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findForAdmin(filter, pagination);
    return {
      data: data.map((p) => ({
        ...serializePayout(p),
        seller: {
          businessName: p.seller.businessName,
          sellerType: p.seller.sellerType,
          brandName: p.seller.brand?.name ?? null,
        },
      })),
      total,
    };
  }

  async getForAdmin(id: string): Promise<Payout> {
    return this.getByIdOrThrow(id);
  }
}

export const payoutsService = new PayoutsService();
