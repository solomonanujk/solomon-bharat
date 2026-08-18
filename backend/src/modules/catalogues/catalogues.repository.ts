import { AgentProfile, Catalogue, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';

export interface CreateCatalogueData {
  title: string;
  productIds: string[];
  fileUrl: string;
  publicId?: string;
}

export class CataloguesRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Direct Prisma lookup kept local to this module (not imported from
   * agent-applications) so this module stays self-contained.
   */
  findAgentProfileByUserId(userId: string): Promise<AgentProfile | null> {
    return this.db.agentProfile.findUnique({ where: { userId } });
  }

  create(agentId: string, data: CreateCatalogueData): Promise<Catalogue> {
    return this.db.catalogue.create({
      data: {
        agentId,
        title: data.title,
        productIds: data.productIds,
        fileUrl: data.fileUrl,
        publicId: data.publicId,
      },
    });
  }

  findByIdForAgent(agentId: string, id: string): Promise<Catalogue | null> {
    return this.db.catalogue.findFirst({ where: { id, agentId } });
  }

  async listForAgent(
    agentId: string,
    pagination: PaginationQuery,
  ): Promise<{ data: Catalogue[]; total: number }> {
    const where = { agentId };
    const [data, total] = await Promise.all([
      this.db.catalogue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.catalogue.count({ where }),
    ]);
    return { data, total };
  }
}

export const cataloguesRepository = new CataloguesRepository();
