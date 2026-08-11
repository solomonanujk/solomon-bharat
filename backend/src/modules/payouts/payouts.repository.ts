import { Payout, PayoutStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { PayoutListFilter } from './payouts.types';

export class PayoutsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<Payout | null> {
    return this.db.payout.findUnique({ where: { id } });
  }

  async existsForOrder(orderId: string): Promise<boolean> {
    const count = await this.db.payout.count({ where: { orderId } });
    return count > 0;
  }

  async createManyForOrder(orderId: string): Promise<void> {
    const items = await this.db.orderItem.findMany({ where: { orderId } });
    if (items.length === 0) return;

    await this.db.payout.createMany({
      data: items.map((item) => ({
        sellerId: item.sellerId,
        orderId,
        orderItemId: item.id,
        amount: item.lineSellerTotal,
        status: PayoutStatus.PENDING,
      })),
    });
  }

  markPaid(id: string, notes: string | undefined): Promise<Payout> {
    return this.db.payout.update({
      where: { id },
      data: { status: PayoutStatus.PAID, paidAt: new Date(), ...(notes ? { notes } : {}) },
    });
  }

  setNotes(id: string, notes: string): Promise<Payout> {
    return this.db.payout.update({ where: { id }, data: { notes } });
  }

  async findForSeller(
    sellerId: string,
    filter: PayoutListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: Payout[]; total: number }> {
    const where: Prisma.PayoutWhereInput = { sellerId, ...(filter.status ? { status: filter.status } : {}) };
    const [data, total] = await Promise.all([
      this.db.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.payout.count({ where }),
    ]);
    return { data, total };
  }

  async findForAdmin(
    filter: PayoutListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: (Payout & { seller: { businessName: string } })[]; total: number }> {
    const where: Prisma.PayoutWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.payout.findMany({
        where,
        include: { seller: { select: { businessName: true } } },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.payout.count({ where }),
    ]);
    return { data, total };
  }

  async sumForSeller(sellerId: string, status: PayoutStatus): Promise<number> {
    const result = await this.db.payout.aggregate({
      where: { sellerId, status },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  findLastPaidForSeller(sellerId: string): Promise<Payout | null> {
    return this.db.payout.findFirst({
      where: { sellerId, status: PayoutStatus.PAID },
      orderBy: { paidAt: 'desc' },
    });
  }
}

export const payoutsRepository = new PayoutsRepository();
