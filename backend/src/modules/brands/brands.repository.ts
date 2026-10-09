import { Brand, BrandStatus, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { AdminBrandListFilter, BrandOrderStats, UpdateOwnBrandInput } from './brands.types';

// A product only counts toward a brand's storefront when it is live.
const LIVE_PRODUCT_FILTER = { approvalStatus: 'APPROVED', isPublished: true, deletedAt: null } as const;

const PUBLIC_COUNTS = {
  _count: { select: { products: { where: LIVE_PRODUCT_FILTER }, followers: true } },
} satisfies Prisma.BrandInclude;

export type BrandWithCounts = Brand & { _count: { products: number; followers: number } };

export type AdminBrandRow = BrandWithCounts & {
  sellerProfile: {
    id: string;
    businessName: string;
    contactName: string;
    phone: string;
    user: { email: string };
  };
};

export class BrandsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  private searchWhere(search?: string): Prisma.BrandWhereInput {
    return search ? { name: { contains: search, mode: 'insensitive' } } : {};
  }

  async findActive(search: string | undefined, pagination: PaginationQuery) {
    const where: Prisma.BrandWhereInput = { status: BrandStatus.ACTIVE, ...this.searchWhere(search) };
    const [data, total] = await Promise.all([
      this.db.brand.findMany({
        where,
        include: PUBLIC_COUNTS,
        orderBy: [{ isVerified: 'desc' }, { name: 'asc' }],
        ...toSkipTake(pagination),
      }),
      this.db.brand.count({ where }),
    ]);
    return { data: data as BrandWithCounts[], total };
  }

  findActiveBySlug(slug: string): Promise<BrandWithCounts | null> {
    return this.db.brand.findFirst({
      where: { slug, status: BrandStatus.ACTIVE },
      include: PUBLIC_COUNTS,
    }) as Promise<BrandWithCounts | null>;
  }

  /** Includes suspended brands — used for idempotent unfollow. */
  findBySlug(slug: string): Promise<Brand | null> {
    return this.db.brand.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Brand | null> {
    return this.db.brand.findUnique({ where: { id } });
  }

  findByUserId(userId: string): Promise<BrandWithCounts | null> {
    return this.db.brand.findFirst({
      where: { sellerProfile: { userId, deletedAt: null } },
      include: PUBLIC_COUNTS,
    }) as Promise<BrandWithCounts | null>;
  }

  updateBrand(id: string, data: UpdateOwnBrandInput | Prisma.BrandUpdateInput): Promise<Brand> {
    return this.db.brand.update({ where: { id }, data: data as Prisma.BrandUpdateInput });
  }

  // ── Follows ──────────────────────────────────────────────────────────────

  async findBuyerProfileId(userId: string): Promise<string | null> {
    const profile = await this.db.buyerProfile.findUnique({ where: { userId }, select: { id: true } });
    return profile?.id ?? null;
  }

  async isFollowing(buyerId: string, brandId: string): Promise<boolean> {
    const row = await this.db.brandFollow.findUnique({
      where: { buyerId_brandId: { buyerId, brandId } },
      select: { id: true },
    });
    return row !== null;
  }

  followBrand(buyerId: string, brandId: string): Promise<unknown> {
    return this.db.brandFollow.upsert({
      where: { buyerId_brandId: { buyerId, brandId } },
      update: {},
      create: { buyerId, brandId },
    });
  }

  unfollowBrand(buyerId: string, brandId: string): Promise<unknown> {
    return this.db.brandFollow.deleteMany({ where: { buyerId, brandId } });
  }

  async findFollowedBrands(buyerId: string, pagination: PaginationQuery) {
    const where: Prisma.BrandFollowWhereInput = { buyerId, brand: { status: BrandStatus.ACTIVE } };
    const [rows, total] = await Promise.all([
      this.db.brandFollow.findMany({
        where,
        include: { brand: { include: PUBLIC_COUNTS } },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.brandFollow.count({ where }),
    ]);
    return { data: rows.map((r) => r.brand as BrandWithCounts), total };
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async findAllForAdmin(filter: AdminBrandListFilter, pagination: PaginationQuery) {
    const where: Prisma.BrandWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...this.searchWhere(filter.search),
    };
    const [data, total] = await Promise.all([
      this.db.brand.findMany({
        where,
        include: {
          ...PUBLIC_COUNTS,
          sellerProfile: {
            select: {
              id: true,
              businessName: true,
              contactName: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.brand.count({ where }),
    ]);
    return { data: data as AdminBrandRow[], total };
  }

  /** Paid, non-cancelled orders per brand seller profile (count + GMV in INR). */
  async getOrderStatsBySellerProfile(sellerProfileIds: string[]): Promise<Map<string, BrandOrderStats>> {
    if (sellerProfileIds.length === 0) return new Map();
    const rows = await this.db.order.groupBy({
      by: ['sellerProfileId'],
      where: {
        sellerProfileId: { in: sellerProfileIds },
        deletedAt: null,
        status: { notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED] },
      },
      _count: { _all: true },
      _sum: { adminPriceTotal: true },
    });
    const map = new Map<string, BrandOrderStats>();
    for (const row of rows) {
      if (row.sellerProfileId) {
        map.set(row.sellerProfileId, {
          ordersCount: row._count._all,
          gmv: Number(row._sum.adminPriceTotal ?? 0),
        });
      }
    }
    return map;
  }

  // ── Platform settings (commission defaults) ──────────────────────────────

  async findSettingValue(key: string): Promise<Prisma.JsonValue | null> {
    const setting = await this.db.platformSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  upsertSetting(key: string, value: number): Promise<unknown> {
    return this.db.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

export const brandsRepository = new BrandsRepository();
