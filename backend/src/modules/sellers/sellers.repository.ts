import { Prisma, PrismaClient, Role, SellerApplication, SellerProfile, User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { ApplicationListFilter, SubmitApplicationInput, UpdateSellerProfileInput } from './sellers.types';

export class SellersRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  createApplication(input: SubmitApplicationInput): Promise<SellerApplication> {
    return this.db.sellerApplication.create({ data: input });
  }

  findApplicationById(id: string): Promise<SellerApplication | null> {
    return this.db.sellerApplication.findUnique({ where: { id } });
  }

  findLatestApplicationByEmail(email: string): Promise<SellerApplication | null> {
    return this.db.sellerApplication.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findApplications(
    filter: ApplicationListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: SellerApplication[]; total: number }> {
    const where = filter.status ? { status: filter.status } : {};
    const [data, total] = await Promise.all([
      this.db.sellerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.sellerApplication.count({ where }),
    ]);
    return { data, total };
  }

  updateApplication(
    id: string,
    data: Partial<
      Pick<SellerApplication, 'status' | 'rejectionReason' | 'internalNotes' | 'reviewedById' | 'reviewedAt'>
    >,
  ): Promise<SellerApplication> {
    return this.db.sellerApplication.update({ where: { id }, data });
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async createSellerUserAndProfile(
    application: SellerApplication,
    passwordHash: string,
  ): Promise<{ user: User; profile: SellerProfile }> {
    const user = await this.db.user.create({
      data: {
        email: application.email,
        passwordHash,
        role: Role.SELLER,
        emailVerifiedAt: new Date(),
        sellerProfile: {
          create: {
            applicationId: application.id,
            businessName: application.businessName,
            contactName: application.contactName,
            phone: application.phone,
            businessAddress: application.businessAddress,
          },
        },
      },
      include: { sellerProfile: true },
    });
    return { user, profile: user.sellerProfile as SellerProfile };
  }

  findSellerProfileByUserId(userId: string): Promise<SellerProfile | null> {
    return this.db.sellerProfile.findUnique({ where: { userId } });
  }

  findSellerProfileById(id: string): Promise<SellerProfile | null> {
    return this.db.sellerProfile.findUnique({ where: { id } });
  }

  updateSellerProfile(id: string, input: UpdateSellerProfileInput): Promise<SellerProfile> {
    const data: Prisma.SellerProfileUpdateInput = {
      ...input,
      notificationPrefs: input.notificationPrefs as Prisma.InputJsonValue | undefined,
    };
    return this.db.sellerProfile.update({ where: { id }, data });
  }

  async findSellers(
    pagination: PaginationQuery,
  ): Promise<{ data: (SellerProfile & { user: User })[]; total: number }> {
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.db.sellerProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.sellerProfile.count({ where }),
    ]);
    return { data, total };
  }

  findSellerWithUserById(id: string): Promise<(SellerProfile & { user: User }) | null> {
    return this.db.sellerProfile.findUnique({ where: { id }, include: { user: true } });
  }
}

export const sellersRepository = new SellersRepository();
