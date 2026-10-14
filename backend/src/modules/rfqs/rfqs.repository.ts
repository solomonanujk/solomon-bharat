import { Prisma, PrismaClient, Rfq, RfqStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';

const ADMIN_INCLUDE = {
  user: { select: { id: true, email: true, role: true } },
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.RfqInclude;

export type AdminRfq = Prisma.RfqGetPayload<{ include: typeof ADMIN_INCLUDE }>;

export class RfqsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(data: Prisma.RfqUncheckedCreateInput): Promise<Rfq> {
    return this.db.rfq.create({ data });
  }

  findProductForRfq(id: string) {
    return this.db.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, offersSamples: true, sampleMaxQty: true },
    });
  }

  async listForUser(userId: string, pagination: PaginationQuery): Promise<{ data: Rfq[]; total: number }> {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.db.rfq.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.rfq.count({ where }),
    ]);
    return { data, total };
  }

  async listForAdmin(
    status: RfqStatus | undefined,
    pagination: PaginationQuery,
  ): Promise<{ data: AdminRfq[]; total: number }> {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.db.rfq.findMany({ where, include: ADMIN_INCLUDE, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.rfq.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<Rfq | null> {
    return this.db.rfq.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.RfqUpdateInput): Promise<Rfq> {
    return this.db.rfq.update({ where: { id }, data });
  }
}

export const rfqsRepository = new RfqsRepository();
