import { Brand, Prisma, PrismaClient, Role, SellerApplication, SellerProfile, SellerType, User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { ApplicationListFilter, SubmitApplicationInput, UpdateSellerProfileInput } from './sellers.types';

/** Public-safe brand reference shown next to a seller in admin lists (no legal/rate fields). */
const ADMIN_BRAND_REF_SELECT = { id: true, name: true, slug: true, status: true, isVerified: true } as const;
type AdminBrandRef = Prisma.BrandGetPayload<{ select: typeof ADMIN_BRAND_REF_SELECT }>;

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

  /**
   * Creates the SELLER account + profile from an approved application. For a MARKETPLACE
   * application `brandSlug` must be supplied and the Brand row is created in the same
   * nested write (one transaction), so a MARKETPLACE profile never exists without its brand.
   */
  async createSellerUserAndProfile(
    application: SellerApplication,
    passwordHash: string,
    brandSlug?: string,
  ): Promise<{ user: User; profile: SellerProfile; brand: Brand | null }> {
    const isMarketplace = application.sellerType === SellerType.MARKETPLACE && brandSlug !== undefined;
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
            sellerType: isMarketplace ? SellerType.MARKETPLACE : SellerType.CURATED,
            ...(isMarketplace
              ? {
                  brand: {
                    create: {
                      name: application.brandName ?? application.businessName,
                      slug: brandSlug,
                      logoUrl: application.brandLogoUrl,
                      bannerUrl: application.brandBannerUrl,
                      story: application.brandStory,
                      website: application.brandWebsite ?? application.websiteOrSocialLink,
                      country: application.country,
                      minOrderValueInr: application.minOrderValueInr ?? 0,
                    },
                  },
                }
              : {}),
          },
        },
      },
      include: { sellerProfile: { include: { brand: true } } },
    });
    const profile = user.sellerProfile as SellerProfile & { brand: Brand | null };
    return { user, profile, brand: profile.brand ?? null };
  }

  async brandSlugExists(slug: string): Promise<boolean> {
    const count = await this.db.brand.count({ where: { slug } });
    return count > 0;
  }

  findSellerProfileWithBrandByUserId(userId: string): Promise<(SellerProfile & { brand: Brand | null }) | null> {
    return this.db.sellerProfile.findUnique({ where: { userId }, include: { brand: true } });
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
  ): Promise<{ data: (SellerProfile & { user: User; brand: AdminBrandRef | null })[]; total: number }> {
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.db.sellerProfile.findMany({
        where,
        include: { user: true, brand: { select: ADMIN_BRAND_REF_SELECT } },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.sellerProfile.count({ where }),
    ]);
    return { data, total };
  }

  findSellerWithUserById(
    id: string,
  ): Promise<(SellerProfile & { user: User; brand: AdminBrandRef | null }) | null> {
    return this.db.sellerProfile.findUnique({
      where: { id },
      include: { user: true, brand: { select: ADMIN_BRAND_REF_SELECT } },
    });
  }

  // ─── House seller profile (admin-authored products with no real seller) ──────

  async findPlatformSettingValue(key: string): Promise<Prisma.JsonValue | null> {
    const setting = await this.db.platformSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  upsertPlatformSetting(key: string, value: unknown): Promise<unknown> {
    return this.db.platformSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }

  /** Same shape as createSellerUserAndProfile, but with no SellerApplication behind
   *  it — this is an internal, never-logged-into anchor account. */
  async createHouseSellerUserAndProfile(input: {
    email: string;
    passwordHash: string;
    businessName: string;
    contactName: string;
    phone: string;
    businessAddress: string;
  }): Promise<{ user: User; profile: SellerProfile }> {
    const user = await this.db.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: Role.SELLER,
        emailVerifiedAt: new Date(),
        sellerProfile: {
          create: {
            businessName: input.businessName,
            contactName: input.contactName,
            phone: input.phone,
            businessAddress: input.businessAddress,
          },
        },
      },
      include: { sellerProfile: true },
    });
    return { user, profile: user.sellerProfile as SellerProfile };
  }
}

export const sellersRepository = new SellersRepository();
