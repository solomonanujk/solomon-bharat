import { OrderStatus, Payout, PayoutStatus, Prisma, PrismaClient, SellerType } from '@prisma/client';
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

  /** Brand order: one PENDING payout per item; amount is the NET, with the gross/commission breakdown. */
  async createManyForBrandOrder(orderId: string): Promise<void> {
    const items = await this.db.orderItem.findMany({ where: { orderId } });
    if (items.length === 0) return;

    await this.db.payout.createMany({
      data: items.map((item) => ({
        sellerId: item.sellerId,
        orderId,
        orderItemId: item.id,
        amount: item.lineSellerTotal,
        grossAmount: item.lineAdminTotal,
        commissionRate: item.commissionRate,
        commissionAmount: item.commissionAmount,
        status: PayoutStatus.PENDING,
      })),
      skipDuplicates: true,
    });
  }

  findOrderForPayout(orderId: string) {
    return this.db.order.findUnique({ where: { id: orderId }, select: { id: true, sellerProfileId: true } });
  }

  async sumCommissionForSeller(sellerId: string): Promise<number> {
    const result = await this.db.payout.aggregate({ where: { sellerId }, _sum: { commissionAmount: true } });
    return Number(result._sum.commissionAmount ?? 0);
  }

  /** Orders that count as sales for a brand: paid and not cancelled. */
  findPaidOrdersForBrand(sellerProfileId: string, since?: Date) {
    return this.db.order.findMany({
      where: {
        sellerProfileId,
        deletedAt: null,
        status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { createdAt: true, adminPriceTotal: true },
    });
  }

  findPaidItemsForBrand(sellerProfileId: string) {
    return this.db.orderItem.findMany({
      where: {
        order: {
          sellerProfileId,
          deletedAt: null,
          status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        lineAdminTotal: true,
        lineSellerTotal: true,
        commissionAmount: true,
        product: { select: { name: true } },
      },
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
  ): Promise<{
    data: (Payout & { seller: { businessName: string; sellerType: SellerType; brand: { name: string } | null } })[];
    total: number;
  }> {
    const where: Prisma.PayoutWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.payout.findMany({
        where,
        include: {
          seller: { select: { businessName: true, sellerType: true, brand: { select: { name: true } } } },
        },
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
