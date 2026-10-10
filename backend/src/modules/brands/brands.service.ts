import { Brand, BrandStatus, Prisma, Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { entityFolder } from '../../utils/helpers';
import { PaginationQuery } from '../../utils/pagination';
import { storageProvider } from '../../providers/storage';
import { MAX_IMAGE_FILE_SIZE_BYTES } from '../../middleware/upload';
import { productsService } from '../products/products.service';
import { payoutsService } from '../payouts/payouts.service';
import { BrandsRepository, BrandWithCounts, brandsRepository } from './brands.repository';
import {
  AdminBrandListFilter,
  AdminUpdateBrandInput,
  BrandListItem,
  COMMISSION_FIRST_SETTING_KEY,
  COMMISSION_REPEAT_SETTING_KEY,
  CommissionRates,
  DEFAULT_COMMISSION_FIRST,
  DEFAULT_COMMISSION_REPEAT,
  OwnBrand,
  PublicBrand,
  UpdateOwnBrandInput,
} from './brands.types';

export interface ViewerContext {
  id: string;
  role: Role;
}

export interface UploadedBrandImage {
  buffer: Buffer;
  originalname: string;
}

const toNumberOrNull = (value: Prisma.Decimal | number | null): number | null =>
  value === null ? null : Number(value);

/** Reads a numeric percent stored in PlatformSetting (plain number, or `{ value }`). */
function parsePercent(raw: Prisma.JsonValue | null, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.value === 'number') return raw.value;
  return fallback;
}

export function toBrandListItem(brand: BrandWithCounts): BrandListItem {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    isVerified: brand.isVerified,
    country: brand.country,
    productCount: brand._count.products,
  };
}

/** Explicit public whitelist — never spread the Brand row. */
export function toPublicBrand(brand: BrandWithCounts, isFollowing: boolean): PublicBrand {
  return {
    ...toBrandListItem(brand),
    bannerUrl: brand.bannerUrl,
    story: brand.story,
    website: brand.website,
    instagram: brand.instagram,
    returnPolicy: brand.returnPolicy,
    minOrderValueInr: Number(brand.minOrderValueInr),
    followerCount: brand._count.followers,
    isFollowing,
  };
}

export class BrandsService {
  constructor(private readonly repo: BrandsRepository = brandsRepository) {}

  private async invalidateProductCache(): Promise<void> {
    await productsService.invalidatePublishedListCache();
  }

  // ── Public ───────────────────────────────────────────────────────────────

  async listPublic(search: string | undefined, pagination: PaginationQuery, viewerRole?: Role) {
    // Agents only deal with Solomon-curated products — brands are hidden from them.
    if (viewerRole === Role.AGENT) {
      return { data: [], total: 0 };
    }
    const { data, total } = await this.repo.findActive(search, pagination);
    return { data: data.map(toBrandListItem), total };
  }

  async getPublicBySlug(slug: string, viewer?: ViewerContext): Promise<PublicBrand> {
    if (viewer?.role === Role.AGENT) {
      throw AppError.notFound('Brand not found');
    }
    const brand = await this.repo.findActiveBySlug(slug);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }
    let isFollowing = false;
    if (viewer && viewer.role === Role.BUYER) {
      const buyerId = await this.repo.findBuyerProfileId(viewer.id);
      isFollowing = buyerId ? await this.repo.isFollowing(buyerId, brand.id) : false;
    }
    return toPublicBrand(brand, isFollowing);
  }

  // ── Follow ───────────────────────────────────────────────────────────────

  private async getBuyerIdOrThrow(userId: string): Promise<string> {
    const buyerId = await this.repo.findBuyerProfileId(userId);
    if (!buyerId) {
      throw AppError.notFound('Buyer profile not found');
    }
    return buyerId;
  }

  async follow(userId: string, slug: string): Promise<{ isFollowing: true }> {
    const buyerId = await this.getBuyerIdOrThrow(userId);
    const brand = await this.repo.findActiveBySlug(slug);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }
    await this.repo.followBrand(buyerId, brand.id);
    return { isFollowing: true };
  }

  /** Idempotent: unfollowing a brand you do not follow succeeds. */
  async unfollow(userId: string, slug: string): Promise<{ isFollowing: false }> {
    const buyerId = await this.getBuyerIdOrThrow(userId);
    const brand = await this.repo.findBySlug(slug);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }
    await this.repo.unfollowBrand(buyerId, brand.id);
    return { isFollowing: false };
  }

  async listFollowing(userId: string, pagination: PaginationQuery) {
    const buyerId = await this.getBuyerIdOrThrow(userId);
    const { data, total } = await this.repo.findFollowedBrands(buyerId, pagination);
    return { data: data.map(toBrandListItem), total };
  }

  // ── Brand owner ──────────────────────────────────────────────────────────

  private async getOwnBrandRowOrThrow(userId: string): Promise<BrandWithCounts> {
    const brand = await this.repo.findByUserId(userId);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }
    return brand;
  }

  private toOwnBrand(brand: BrandWithCounts): OwnBrand {
    return {
      ...toPublicBrand(brand, false),
      status: brand.status,
      legalName: brand.legalName,
      gstin: brand.gstin,
      commissionFirstOverride: toNumberOrNull(brand.commissionFirstOverride),
      commissionRepeatOverride: toNumberOrNull(brand.commissionRepeatOverride),
    };
  }

  async getMyBrand(userId: string): Promise<OwnBrand> {
    return this.toOwnBrand(await this.getOwnBrandRowOrThrow(userId));
  }

  async updateMyBrand(userId: string, input: UpdateOwnBrandInput): Promise<OwnBrand> {
    const brand = await this.getOwnBrandRowOrThrow(userId);
    await this.repo.updateBrand(brand.id, input);
    await this.invalidateProductCache();
    return this.getMyBrand(userId);
  }

  async uploadMyBrandImage(
    userId: string,
    kind: 'logo' | 'banner',
    file: UploadedBrandImage | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw AppError.badRequest('An image file is required');
    }
    if (file.buffer.length > MAX_IMAGE_FILE_SIZE_BYTES) {
      throw AppError.badRequest('Image must be 5MB or smaller');
    }
    const brand = await this.getOwnBrandRowOrThrow(userId);
    const folder = entityFolder('brands', brand.slug, brand.id);
    const upload = await storageProvider.uploadImage(file.buffer, `${Date.now()}-${kind}-${file.originalname}`, folder);
    return { url: upload.url };
  }

  async getMyStats(userId: string) {
    const brand = await this.getOwnBrandRowOrThrow(userId);
    return payoutsService.getBrandSalesStats(brand.sellerProfileId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async listForAdmin(filter: AdminBrandListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findAllForAdmin(filter, pagination);
    const stats = await this.repo.getOrderStatsBySellerProfile(data.map((b) => b.sellerProfileId));
    const rows = data.map((brand) => {
      const { sellerProfile, _count, ...rest } = brand;
      return {
        ...rest,
        minOrderValueInr: Number(brand.minOrderValueInr),
        commissionFirstOverride: toNumberOrNull(brand.commissionFirstOverride),
        commissionRepeatOverride: toNumberOrNull(brand.commissionRepeatOverride),
        productCount: _count.products,
        followerCount: _count.followers,
        seller: {
          id: sellerProfile.id,
          businessName: sellerProfile.businessName,
          contactName: sellerProfile.contactName,
          phone: sellerProfile.phone,
          email: sellerProfile.user.email,
        },
        orderStats: stats.get(brand.sellerProfileId) ?? { ordersCount: 0, gmv: 0 },
      };
    });
    return { data: rows, total };
  }

  async updateForAdmin(adminId: string, id: string, input: AdminUpdateBrandInput): Promise<Brand> {
    const brand = await this.repo.findById(id);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }

    for (const key of ['commissionFirstOverride', 'commissionRepeatOverride'] as const) {
      const value = input[key];
      if (value !== undefined && value !== null && (value < 0 || value > 100)) {
        throw AppError.unprocessable(`${key} must be between 0 and 100`);
      }
    }

    const data: Prisma.BrandUpdateInput = {};
    const audits: { action: string; metadata: Record<string, unknown> }[] = [];
    let affectsStorefront = false;

    if (input.isVerified !== undefined && input.isVerified !== brand.isVerified) {
      data.isVerified = input.isVerified;
      affectsStorefront = true;
      audits.push({
        action: input.isVerified ? 'BRAND_VERIFIED' : 'BRAND_UNVERIFIED',
        metadata: { from: brand.isVerified, to: input.isVerified },
      });
    }
    if (input.status !== undefined && input.status !== brand.status) {
      data.status = input.status;
      affectsStorefront = true;
      audits.push({
        action: input.status === BrandStatus.SUSPENDED ? 'BRAND_SUSPENDED' : 'BRAND_REACTIVATED',
        metadata: { from: brand.status, to: input.status },
      });
    }
    if (input.name !== undefined && input.name !== brand.name) {
      data.name = input.name;
      affectsStorefront = true;
      audits.push({ action: 'BRAND_RENAMED', metadata: { from: brand.name, to: input.name } });
    }

    const overrides: Record<string, unknown> = {};
    if (input.commissionFirstOverride !== undefined) {
      const previous = toNumberOrNull(brand.commissionFirstOverride);
      if (previous !== input.commissionFirstOverride) {
        data.commissionFirstOverride = input.commissionFirstOverride;
        overrides.first = { from: previous, to: input.commissionFirstOverride };
      }
    }
    if (input.commissionRepeatOverride !== undefined) {
      const previous = toNumberOrNull(brand.commissionRepeatOverride);
      if (previous !== input.commissionRepeatOverride) {
        data.commissionRepeatOverride = input.commissionRepeatOverride;
        overrides.repeat = { from: previous, to: input.commissionRepeatOverride };
      }
    }
    if (Object.keys(overrides).length > 0) {
      audits.push({ action: 'BRAND_COMMISSION_OVERRIDDEN', metadata: overrides });
    }

    if (Object.keys(data).length === 0) {
      return brand;
    }

    const updated = await this.repo.updateBrand(id, data);
    for (const entry of audits) {
      // eslint-disable-next-line no-await-in-loop
      await writeAuditLog(adminId, entry.action, 'Brand', id, entry.metadata);
    }
    if (affectsStorefront) {
      await this.invalidateProductCache();
    }
    return updated;
  }

  async getCommissionDefaults(): Promise<CommissionRates> {
    const [first, repeat] = await Promise.all([
      this.repo.findSettingValue(COMMISSION_FIRST_SETTING_KEY),
      this.repo.findSettingValue(COMMISSION_REPEAT_SETTING_KEY),
    ]);
    return {
      first: parsePercent(first, DEFAULT_COMMISSION_FIRST),
      repeat: parsePercent(repeat, DEFAULT_COMMISSION_REPEAT),
    };
  }

  async setCommissionDefaults(adminId: string, rates: CommissionRates): Promise<CommissionRates> {
    for (const value of [rates.first, rates.repeat]) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw AppError.unprocessable('Commission rates must be between 0 and 100');
      }
    }
    const previous = await this.getCommissionDefaults();
    await this.repo.upsertSetting(COMMISSION_FIRST_SETTING_KEY, rates.first);
    await this.repo.upsertSetting(COMMISSION_REPEAT_SETTING_KEY, rates.repeat);
    await writeAuditLog(adminId, 'MARKETPLACE_COMMISSION_DEFAULTS_UPDATED', 'PlatformSetting', 'marketplace_commission', {
      from: previous,
      to: rates,
    });
    return rates;
  }

  /**
   * Effective rates for a brand: per-brand override, else the platform default, else 25/15.
   * Used by the orders module when locking commission at the paid transition.
   */
  async resolveCommissionRates(brandId: string): Promise<CommissionRates> {
    const brand = await this.repo.findById(brandId);
    if (!brand) {
      throw AppError.notFound('Brand not found');
    }
    const defaults = await this.getCommissionDefaults();
    return {
      first: toNumberOrNull(brand.commissionFirstOverride) ?? defaults.first,
      repeat: toNumberOrNull(brand.commissionRepeatOverride) ?? defaults.repeat,
    };
  }
}

export const brandsService = new BrandsService();
