import { Payout, PayoutStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { PaginationQuery } from '../../utils/pagination';
import { prisma } from '../../config/prisma';
import { notificationsService } from '../notifications/notifications.service';
import { PayoutsRepository, payoutsRepository } from './payouts.repository';
import { PayoutListFilter, SellerPayoutSummary } from './payouts.types';

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
    return { data: data.map((p) => ({ ...p, amount: p.amount.toString() })), total };
  }

  async getSellerSummary(sellerId: string): Promise<SellerPayoutSummary> {
    const [totalEarned, pendingPayout, lastPayout] = await Promise.all([
      this.repo.sumForSeller(sellerId, PayoutStatus.PAID),
      this.repo.sumForSeller(sellerId, PayoutStatus.PENDING),
      this.repo.findLastPaidForSeller(sellerId),
    ]);

    return {
      totalEarned: totalEarned.toFixed(2),
      pendingPayout: pendingPayout.toFixed(2),
      lastPayout: lastPayout && lastPayout.paidAt ? { amount: lastPayout.amount.toString(), paidAt: lastPayout.paidAt } : null,
    };
  }

  async listForAdmin(filter: PayoutListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findForAdmin(filter, pagination);
    return { data: data.map((p) => ({ ...p, amount: p.amount.toString() })), total };
  }

  async getForAdmin(id: string): Promise<Payout> {
    return this.getByIdOrThrow(id);
  }
}

export const payoutsService = new PayoutsService();
