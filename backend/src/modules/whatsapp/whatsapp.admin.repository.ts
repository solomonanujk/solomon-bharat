import { PrismaClient, ProductApprovalStatus, ProductSource, WhatsAppSession } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';

export type SessionWithSeller = WhatsAppSession & { seller: { businessName: string } };

export interface LinkedSellerRow {
  id: string;
  businessName: string;
  whatsappNumber: string | null;
  whatsappVerifiedAt: Date | null;
}

/** Read-only queries behind the admin WhatsApp tab. */
export class WhatsAppAdminRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  countPendingProducts(): Promise<number> {
    return this.db.product.count({
      where: { source: ProductSource.WHATSAPP, approvalStatus: ProductApprovalStatus.PENDING, deletedAt: null },
    });
  }

  countLiveSessions(now: Date): Promise<number> {
    return this.db.whatsAppSession.count({ where: { expiresAt: { gt: now } } });
  }

  countLinkedSellers(): Promise<number> {
    return this.db.sellerProfile.count({ where: { whatsappNumber: { not: null }, deletedAt: null } });
  }

  /** Open listings that have not expired, most recently active first. */
  async findLiveSessions(now: Date, pagination: PaginationQuery): Promise<{ data: SessionWithSeller[]; total: number }> {
    const where = { expiresAt: { gt: now } };
    const [data, total] = await Promise.all([
      this.db.whatsAppSession.findMany({
        where,
        include: { seller: { select: { businessName: true } } },
        orderBy: { lastMessageAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.whatsAppSession.count({ where }),
    ]);
    return { data, total };
  }

  async findLinkedSellers(
    filter: { search?: string },
    pagination: PaginationQuery,
  ): Promise<{ data: LinkedSellerRow[]; total: number }> {
    const where = {
      deletedAt: null,
      whatsappNumber: { not: null },
      ...(filter.search
        ? {
            OR: [
              { businessName: { contains: filter.search, mode: 'insensitive' as const } },
              { whatsappNumber: { contains: filter.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.db.sellerProfile.findMany({
        where,
        select: { id: true, businessName: true, whatsappNumber: true, whatsappVerifiedAt: true },
        orderBy: { whatsappVerifiedAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.sellerProfile.count({ where }),
    ]);
    return { data, total };
  }

  /** Products each of these sellers created by chat. */
  async countWhatsAppProductsBySeller(sellerIds: string[]): Promise<Map<string, number>> {
    if (sellerIds.length === 0) return new Map();
    const rows = await this.db.product.groupBy({
      by: ['sellerId'],
      where: { sellerId: { in: sellerIds }, source: ProductSource.WHATSAPP, deletedAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.sellerId, r._count._all]));
  }

  /** AI calls made on a day (`day` is YYYY-MM-DD, UTC) per seller. */
  async aiCallsOn(sellerIds: string[], day: string): Promise<Map<string, number>> {
    if (sellerIds.length === 0) return new Map();
    const rows = await this.db.whatsAppAiUsage.findMany({
      where: { sellerId: { in: sellerIds }, day },
      select: { sellerId: true, calls: true },
    });
    return new Map(rows.map((r) => [r.sellerId, r.calls]));
  }
}
