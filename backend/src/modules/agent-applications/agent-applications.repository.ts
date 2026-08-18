import { AgentApplication, AgentProfile, PrismaClient, Role, User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import {
  AgentApplicationListFilter,
  SubmitAgentApplicationInput,
  UpdateAgentProfileInput,
} from './agent-applications.types';

export class AgentApplicationsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  createApplication(input: SubmitAgentApplicationInput): Promise<AgentApplication> {
    return this.db.agentApplication.create({ data: input });
  }

  findApplicationById(id: string): Promise<AgentApplication | null> {
    return this.db.agentApplication.findUnique({ where: { id } });
  }

  findLatestApplicationByEmail(email: string): Promise<AgentApplication | null> {
    return this.db.agentApplication.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findApplications(
    filter: AgentApplicationListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: AgentApplication[]; total: number }> {
    const where = filter.status ? { status: filter.status } : {};
    const [data, total] = await Promise.all([
      this.db.agentApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.agentApplication.count({ where }),
    ]);
    return { data, total };
  }

  updateApplication(
    id: string,
    data: Partial<
      Pick<AgentApplication, 'status' | 'rejectionReason' | 'internalNotes' | 'reviewedById' | 'reviewedAt'>
    >,
  ): Promise<AgentApplication> {
    return this.db.agentApplication.update({ where: { id }, data });
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async createAgentUserAndProfile(
    application: AgentApplication,
    passwordHash: string,
  ): Promise<{ user: User; profile: AgentProfile }> {
    const user = await this.db.user.create({
      data: {
        email: application.email,
        passwordHash,
        role: Role.AGENT,
        emailVerifiedAt: new Date(),
        agentProfile: {
          create: {
            applicationId: application.id,
            businessName: application.businessName,
            contactName: application.contactName,
            phone: application.phone,
            businessAddress: application.businessAddress,
          },
        },
        buyerProfile: {
          create: {
            contactName: application.contactName,
            country: application.country,
            companyName: application.businessName,
            phone: application.phone,
          },
        },
      },
      include: { agentProfile: true, buyerProfile: true },
    });
    return { user, profile: user.agentProfile as AgentProfile };
  }

  findAgentProfileByUserId(userId: string): Promise<AgentProfile | null> {
    return this.db.agentProfile.findUnique({ where: { userId } });
  }

  findAgentProfileById(id: string): Promise<AgentProfile | null> {
    return this.db.agentProfile.findUnique({ where: { id } });
  }

  updateAgentProfile(id: string, input: UpdateAgentProfileInput): Promise<AgentProfile> {
    return this.db.agentProfile.update({ where: { id }, data: input });
  }

  async findAgents(
    pagination: PaginationQuery,
  ): Promise<{ data: (AgentProfile & { user: User })[]; total: number }> {
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.db.agentProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.agentProfile.count({ where }),
    ]);
    return { data, total };
  }

  findAgentWithUserById(id: string): Promise<(AgentProfile & { user: User }) | null> {
    return this.db.agentProfile.findUnique({ where: { id }, include: { user: true } });
  }
}

export const agentApplicationsRepository = new AgentApplicationsRepository();
