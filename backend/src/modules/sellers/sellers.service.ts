import { SellerApplication, SellerApplicationStatus, SellerProfile, SellerType } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { hashPassword } from '../../utils/bcrypt';
import { generateTempPassword, slugify, uniqueSlugSuffix } from '../../utils/helpers';
import { BrandSummaryDto, toBrandSummary } from '../../utils/brandSummary';
import { writeAuditLog } from '../../utils/auditLog';
import { SafeUser, toSafeUser } from '../../utils/safeUser';
import { mailProvider } from '../../providers/mail';
import { PaginationQuery } from '../../utils/pagination';
import { notificationsService } from '../notifications/notifications.service';
import { SellersRepository, sellersRepository } from './sellers.repository';
import {
  ApplicationListFilter,
  SubmitApplicationInput,
  UpdateSellerProfileInput,
} from './sellers.types';

const OPEN_APPLICATION_STATUSES: SellerApplicationStatus[] = [
  SellerApplicationStatus.PENDING,
  SellerApplicationStatus.MORE_INFO_REQUESTED,
];

// Slugs that would shadow a static /brands/* route (e.g. /brands/me).
const RESERVED_BRAND_SLUGS = new Set(['me', 'admin', 'following']);

function appendNote(existing: string | null, note: string): string {
  const stamped = `[${new Date().toISOString()}] ${note}`;
  return existing ? `${existing}\n${stamped}` : stamped;
}

export class SellersService {
  constructor(private readonly repo: SellersRepository = sellersRepository) {}

  private async getApplicationOrThrow(id: string): Promise<SellerApplication> {
    const application = await this.repo.findApplicationById(id);
    if (!application) {
      throw AppError.notFound('Seller application not found');
    }
    return application;
  }

  private assertApplicationIsOpen(application: SellerApplication): void {
    if (!OPEN_APPLICATION_STATUSES.includes(application.status)) {
      throw AppError.badRequest(
        `Application has already been ${application.status.toLowerCase()} and cannot be changed`,
      );
    }
  }

  async submitApplication(input: Omit<SubmitApplicationInput, 'businessAddress'>): Promise<SellerApplication> {
    const existingUser = await this.repo.findUserByEmail(input.email);
    if (existingUser) {
      throw AppError.conflict('An account already exists for this email address');
    }

    const latest = await this.repo.findLatestApplicationByEmail(input.email);
    if (latest && OPEN_APPLICATION_STATUSES.includes(latest.status)) {
      throw AppError.conflict('An application for this email is already under review');
    }

    // Brand answers only apply to marketplace applications; drop them for curated
    // ones so a curated record never carries half a brand.
    const isMarketplace = input.sellerType === SellerType.MARKETPLACE;
    const sanitized: Omit<SubmitApplicationInput, 'businessAddress'> = isMarketplace
      ? { ...input, commissionAgreedAt: new Date() }
      : {
          ...input,
          sellerType: SellerType.CURATED,
          brandName: undefined,
          brandStory: undefined,
          brandLogoUrl: undefined,
          brandBannerUrl: undefined,
          brandWebsite: undefined,
          minOrderValueInr: undefined,
          commissionTermsVersion: undefined,
        };

    // The wizard only collects city + country, not a full street address —
    // SellerProfile.businessAddress still requires a value at approval time
    // (createSellerUserAndProfile copies it 1:1), so it's synthesized here.
    return this.repo.createApplication({ ...sanitized, businessAddress: `${input.city}, ${input.country}` });
  }

  private async generateUniqueBrandSlug(name: string): Promise<string> {
    const base = slugify(name) || 'brand';
    let slug = RESERVED_BRAND_SLUGS.has(base) ? `${base}-${uniqueSlugSuffix()}` : base;
    // eslint-disable-next-line no-await-in-loop
    while (await this.repo.brandSlugExists(slug)) {
      slug = `${base}-${uniqueSlugSuffix()}`;
    }
    return slug;
  }

  async listApplications(
    filter: ApplicationListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: SellerApplication[]; total: number }> {
    return this.repo.findApplications(filter, pagination);
  }

  async getApplicationDetail(id: string): Promise<SellerApplication> {
    return this.getApplicationOrThrow(id);
  }

  async approveApplication(
    id: string,
    adminId: string,
  ): Promise<{ user: SafeUser; profile: SellerProfile }> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const existingUser = await this.repo.findUserByEmail(application.email);
    if (existingUser) {
      throw AppError.conflict('An account already exists for this email address');
    }

    const isMarketplace = application.sellerType === SellerType.MARKETPLACE;
    const brandSlug = isMarketplace
      ? await this.generateUniqueBrandSlug(application.brandName ?? application.businessName)
      : undefined;

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { user, profile, brand } = await this.repo.createSellerUserAndProfile(application, passwordHash, brandSlug);

    await this.repo.updateApplication(id, {
      status: SellerApplicationStatus.APPROVED,
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await writeAuditLog(adminId, 'SELLER_APPLICATION_APPROVED', 'SellerApplication', id, {
      sellerUserId: user.id,
      sellerType: application.sellerType,
      ...(brand ? { brandId: brand.id, brandSlug: brand.slug } : {}),
    });

    if (isMarketplace) {
      await notificationsService.notifyBrandApplicationApproved(user.id);
    } else {
      await notificationsService.notifySellerApplicationApproved(user.id);
    }

    await mailProvider.sendMail({
      to: user.email,
      subject: isMarketplace
        ? 'Your Solomon Bharat brand account is ready'
        : 'Your Solomon Bharat seller account is ready',
      html: `<p>Congratulations — your ${isMarketplace ? 'brand' : 'seller'} application has been approved.</p>
<p>You can now sign in at <a href="${env.APP_URL}">${env.APP_URL}</a> — click "Sign In" in the top navigation — with:</p>
<p>Email: ${user.email}<br/>Temporary password: <strong>${tempPassword}</strong></p>
<p>Please change your password after your first login.</p>${
        isMarketplace ? '<p>Add your products from the seller portal — they go live as soon as you publish them.</p>' : ''
      }`,
    });

    return { user: toSafeUser(user), profile };
  }

  async rejectApplication(id: string, reason: string, adminId: string): Promise<SellerApplication> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const updated = await this.repo.updateApplication(id, {
      status: SellerApplicationStatus.REJECTED,
      rejectionReason: reason,
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await writeAuditLog(adminId, 'SELLER_APPLICATION_REJECTED', 'SellerApplication', id, { reason });

    await mailProvider.sendMail({
      to: application.email,
      subject: 'Update on your Solomon Bharat seller application',
      html: `<p>Thank you for applying to sell on Solomon Bharat. Unfortunately we're unable to move forward with your application at this time.</p><p>Reason: ${reason}</p>`,
    });

    return updated;
  }

  async requestMoreInfo(id: string, message: string, adminId: string): Promise<SellerApplication> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const updated = await this.repo.updateApplication(id, {
      status: SellerApplicationStatus.MORE_INFO_REQUESTED,
      internalNotes: appendNote(application.internalNotes, `Requested more info: ${message}`),
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await mailProvider.sendMail({
      to: application.email,
      subject: 'More information needed for your Solomon Bharat application',
      html: `<p>We need a bit more information to continue reviewing your seller application:</p><p>${message}</p><p>Please reply to this email with the requested details.</p>`,
    });

    return updated;
  }

  async addInternalNote(id: string, note: string): Promise<SellerApplication> {
    const application = await this.getApplicationOrThrow(id);
    return this.repo.updateApplication(id, {
      internalNotes: appendNote(application.internalNotes, note),
    });
  }

  async listSellers(pagination: PaginationQuery) {
    const { data, total } = await this.repo.findSellers(pagination);
    return { data: data.map(({ user, ...profile }) => ({ ...profile, user: toSafeUser(user) })), total };
  }

  async getSellerDetailForAdmin(id: string) {
    const seller = await this.repo.findSellerWithUserById(id);
    if (!seller) {
      throw AppError.notFound('Seller not found');
    }
    const { user, ...profile } = seller;
    return { ...profile, user: toSafeUser(user) };
  }

  private static readonly HOUSE_SELLER_SETTING_KEY = 'house_seller_profile_id';
  private static readonly HOUSE_SELLER_EMAIL = 'house@solomonbharat.internal';

  /**
   * Admin can create products with no real seller behind them ("my own product") —
   * every Product.sellerId still needs a real SellerProfile (which itself needs a
   * real User row), so this provisions one shared, never-logged-into account once
   * and reuses it for every such product from then on. The created id is cached in
   * PlatformSetting so repeat calls are a single indexed lookup, not a repeated
   * email-collision check.
   */
  async getOrCreateHouseSellerProfile(): Promise<string> {
    const cached = await this.repo.findPlatformSettingValue(SellersService.HOUSE_SELLER_SETTING_KEY);
    if (cached && typeof cached === 'object' && 'sellerId' in cached) {
      return (cached as { sellerId: string }).sellerId;
    }

    const passwordHash = await hashPassword(generateTempPassword());
    const { profile } = await this.repo.createHouseSellerUserAndProfile({
      email: SellersService.HOUSE_SELLER_EMAIL,
      passwordHash,
      businessName: 'Solomon Bharat',
      contactName: 'Solomon Bharat',
      phone: 'N/A',
      businessAddress: 'N/A',
    });

    await this.repo.upsertPlatformSetting(SellersService.HOUSE_SELLER_SETTING_KEY, { sellerId: profile.id });
    return profile.id;
  }

  async getMyProfile(userId: string): Promise<SellerProfile> {
    const profile = await this.repo.findSellerProfileByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Seller profile not found');
    }
    return profile;
  }

  /** Seller profile for the portal: includes `sellerType` and, for brands, a public-safe brand summary. */
  async getMyProfileWithBrand(userId: string): Promise<SellerProfile & { brand: BrandSummaryDto | null }> {
    const profile = await this.repo.findSellerProfileWithBrandByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Seller profile not found');
    }
    const { brand, ...rest } = profile;
    return { ...rest, brand: brand ? toBrandSummary(brand) : null };
  }

  async updateMyProfile(userId: string, input: UpdateSellerProfileInput): Promise<SellerProfile> {
    const profile = await this.getMyProfile(userId);
    return this.repo.updateSellerProfile(profile.id, input);
  }
}

export const sellersService = new SellersService();
