import { SellerApplication, SellerApplicationStatus, SellerProfile } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { hashPassword } from '../../utils/bcrypt';
import { generateTempPassword } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { buildCsv, toIsoDate } from '../../utils/csv';
import { readSpreadsheet } from '../product-import/parsers/spreadsheet';
import type { SpreadsheetKind } from '../../middleware/upload';
import { mapImportRow } from './applicationImport';
import { SafeUser, toSafeUser } from '../../utils/safeUser';
import { mailProvider } from '../../providers/mail';
import { PaginationQuery } from '../../utils/pagination';
import { notificationsService } from '../notifications/notifications.service';
import { authService } from '../auth/auth.service';
import { accountReadyEmailHtml } from '../../utils/emailTemplates';
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

function appendNote(existing: string | null, note: string): string {
  const stamped = `[${new Date().toISOString()}] ${note}`;
  return existing ? `${existing}\n${stamped}` : stamped;
}

/**
 * Column order of the Seller Applications CSV export — every useful field on the
 * SellerApplication model, in the order the owner reads an application: who they are,
 * where they are, where the application stands, then the wizard answers.
 * Arrays and booleans are rendered by `csvCell` (semicolon-joined / Yes-No).
 */
const APPLICATION_EXPORT_COLUMNS: { header: string; value: (a: SellerApplication) => unknown }[] = [
  { header: 'Business name', value: (a) => a.businessName },
  { header: 'Contact name', value: (a) => a.contactName },
  { header: 'Email', value: (a) => a.email },
  { header: 'Phone', value: (a) => a.phone },
  { header: 'City', value: (a) => a.city },
  { header: 'Country', value: (a) => a.country },
  { header: 'Business address', value: (a) => a.businessAddress },
  { header: 'Status', value: (a) => a.status },
  { header: 'Favourite', value: (a) => a.isFavourite },
  { header: 'Applied date', value: (a) => a.createdAt },
  { header: 'Reviewed date', value: (a) => a.reviewedAt },
  { header: 'Instagram handle', value: (a) => a.instagramHandle },
  { header: 'Instagram followers', value: (a) => a.instagramFollowers },
  { header: 'Website / social link', value: (a) => a.websiteOrSocialLink },
  { header: 'Craft categories', value: (a) => a.craftCategories },
  { header: 'Product description', value: (a) => a.productDescription },
  { header: 'GI tagged products', value: (a) => a.giTaggedProducts },
  { header: 'Monthly sales volume', value: (a) => a.monthlySalesVolume },
  { header: 'Shipped internationally', value: (a) => a.shippedInternationally },
  { header: 'Approx. export orders', value: (a) => a.approxExportOrders },
  { header: 'Export countries', value: (a) => a.exportCountries },
  { header: 'Selling on Amazon', value: (a) => a.sellingOnAmazon },
  { header: 'Other platforms', value: (a) => a.otherPlatforms },
  { header: 'GST registration', value: (a) => a.gstRegistration },
  { header: 'Company incorporation', value: (a) => a.companyIncorporation },
  { header: 'IEC status', value: (a) => a.iecStatus },
  { header: 'Business type', value: (a) => a.businessType },
  { header: 'How they heard about us', value: (a) => a.hearAboutUs },
  { header: 'Agreed to commission terms', value: (a) => a.agreedToCommissionTerms },
  { header: 'Applicant message', value: (a) => a.message },
  { header: 'Internal notes', value: (a) => a.internalNotes },
  { header: 'Rejection reason', value: (a) => a.rejectionReason },
];

export class SellersService {
  /** Hard ceiling on one CSV export, so a single click can never load an unbounded table. */
  static readonly EXPORT_ROW_CAP = 10_000;

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

    // Every seller is CURATED (the marketplace model was removed, Oct 2026). Every applicant
    // accepts the Seller Agreement; keep which version and when.
    const sanitized: Omit<SubmitApplicationInput, 'businessAddress'> = {
      ...input,
      commissionAgreedAt: input.commissionTermsVersion ? new Date() : undefined,
    };

    // The wizard only collects city + country, not a full street address —
    // SellerProfile.businessAddress still requires a value at approval time
    // (createSellerUserAndProfile copies it 1:1), so it's synthesized here.
    return this.repo.createApplication({ ...sanitized, businessAddress: `${input.city}, ${input.country}` });
  }

  async listApplications(
    filter: ApplicationListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: SellerApplication[]; total: number }> {
    return this.repo.findApplications(filter, pagination);
  }

  /**
   * CSV of every application matching the admin's current filters (status tab, search
   * box, favourites toggle) — not just the page on screen. Capped at
   * {@link SellersService.EXPORT_ROW_CAP} rows; `truncated` tells the caller the cap bit.
   */
  async exportApplicationsCsv(
    filter: ApplicationListFilter,
    adminId: string,
  ): Promise<{ csv: string; filename: string; rows: number; truncated: boolean }> {
    const rows = await this.repo.findApplicationsForExport(filter, SellersService.EXPORT_ROW_CAP);

    const csv = buildCsv(
      APPLICATION_EXPORT_COLUMNS.map((c) => c.header),
      rows.map((a) => APPLICATION_EXPORT_COLUMNS.map((c) => c.value(a))),
    );
    const filename = `seller-applications-${toIsoDate(new Date())}.csv`;

    await writeAuditLog(adminId, 'SELLER_APPLICATIONS_EXPORTED', 'SellerApplication', 'export', {
      rows: rows.length,
      truncated: rows.length === SellersService.EXPORT_ROW_CAP,
      filter: { status: filter.status ?? null, search: filter.search ?? null, favourite: filter.favourite ?? null },
    });

    return { csv, filename, rows: rows.length, truncated: rows.length === SellersService.EXPORT_ROW_CAP };
  }

  /** Stars or unstars an application so the owner can shortlist and filter by it. */
  async setApplicationFavourite(id: string, favourite: boolean, adminId: string): Promise<SellerApplication> {
    await this.getApplicationOrThrow(id);
    const row = await this.repo.setApplicationFavourite(id, favourite, adminId);
    await writeAuditLog(adminId, favourite ? 'SELLER_APPLICATION_FAVOURITED' : 'SELLER_APPLICATION_UNFAVOURITED', 'SellerApplication', id, {
      businessName: row.businessName,
    });
    return row;
  }

  async getApplicationDetail(id: string): Promise<SellerApplication> {
    return this.getApplicationOrThrow(id);
  }

  /** Approves an application: creates the (CURATED) seller account and emails the sign-in details. */
  async approveApplication(id: string, adminId: string): Promise<{ user: SafeUser; profile: SellerProfile }> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const existingUser = await this.repo.findUserByEmail(application.email);
    if (existingUser) {
      throw AppError.conflict('An account already exists for this email address');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { user, profile } = await this.repo.createSellerUserAndProfile(application, passwordHash);

    await this.repo.updateApplication(id, {
      status: SellerApplicationStatus.APPROVED,
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await writeAuditLog(adminId, 'SELLER_APPLICATION_APPROVED', 'SellerApplication', id, {
      sellerUserId: user.id,
    });

    await notificationsService.notifySellerApplicationApproved(user.id);

    const setupUrl = await authService.createPasswordSetupUrl(user.id);
    await mailProvider.sendMail({
      to: user.email,
      subject: 'Your Solomon Bharat seller account is ready',
      html: accountReadyEmailHtml({
        intro: 'Congratulations — your seller application has been approved.',
        email: user.email,
        tempPassword,
        setupUrl,
        signInUrl: env.APP_URL,
      }),
    });

    return { user: toSafeUser(user), profile };
  }

  /**
   * One-off import of applications from the old backend's export (.xlsx/.csv). Inserts only:
   * rows whose email already has an application or account are skipped, never overwritten.
   */
  async importApplications(
    buffer: Buffer,
    kind: SpreadsheetKind,
    adminId: string,
  ): Promise<{
    inserted: number;
    skippedDuplicates: { brand: string; email: string }[];
    skippedOther: { brand: string; reason: string }[];
    failed: { row: number; brand: string; reason: string }[];
  }> {
    const sheet = await readSpreadsheet(buffer, kind);
    for (const col of ['brand', 'founder', 'email', 'phone']) {
      if (!sheet.headers.includes(col)) throw AppError.badRequest(`This file has no "${col}" column`);
    }
    const now = new Date();
    const mapped = sheet.rows.map((r) => mapImportRow(r.rowNumber, r.cells, now));
    const emails = mapped.flatMap((m) => (m.kind === 'ok' ? [m.email] : []));
    const existing = await this.repo.findExistingEmails([...new Set(emails)]);

    const report = {
      inserted: 0,
      skippedDuplicates: [] as { brand: string; email: string }[],
      skippedOther: [] as { brand: string; reason: string }[],
      failed: [] as { row: number; brand: string; reason: string }[],
    };
    const seen = new Set<string>();
    for (const [i, m] of mapped.entries()) {
      if (m.kind === 'skip') {
        report.skippedOther.push({ brand: m.brand, reason: m.reason });
        continue;
      }
      if (m.kind === 'fail') {
        report.failed.push({ row: m.rowNumber, brand: m.brand, reason: m.reason });
        continue;
      }
      if (existing.has(m.email) || seen.has(m.email)) {
        report.skippedDuplicates.push({ brand: m.brand, email: m.email });
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.repo.createImportedApplication(m.data);
        seen.add(m.email);
        report.inserted += 1;
      } catch (err) {
        report.failed.push({
          row: sheet.rows[i].rowNumber,
          brand: m.brand,
          reason: err instanceof Error ? err.message.split('\n').pop()!.slice(0, 200) : 'Unknown error',
        });
      }
    }
    await writeAuditLog(adminId, 'SELLER_APPLICATIONS_IMPORTED', 'SellerApplication', 'import', {
      inserted: report.inserted,
      skippedDuplicates: report.skippedDuplicates.length,
      failed: report.failed.length,
    });
    return report;
  }

  /**
   * Permanently removes a seller application (spam, tests, duplicates). Approved applications
   * are linked to a live seller account and can never be deleted here.
   */
  async deleteApplication(id: string, adminId: string): Promise<void> {
    const application = await this.getApplicationOrThrow(id);
    if (application.status === SellerApplicationStatus.APPROVED) {
      throw AppError.badRequest('Approved applications belong to a live seller account and cannot be deleted');
    }
    await this.repo.deleteApplication(id);
    await writeAuditLog(adminId, 'SELLER_APPLICATION_DELETED', 'SellerApplication', id, {
      businessName: application.businessName,
      email: application.email,
      status: application.status,
    });
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

  async updateMyProfile(
    userId: string,
    input: UpdateSellerProfileInput,
  ): Promise<Omit<SellerProfile, 'internalRating' | 'internalNotes'>> {
    const profile = await this.getMyProfile(userId);
    return withoutInternal(await this.repo.updateSellerProfile(profile.id, input));
  }

  /** Admin-only internal performance rating; never exposed to the seller. */
  async setInternalRating(
    adminId: string,
    sellerProfileId: string,
    input: { internalRating?: number | null; internalNotes?: string | null },
  ): Promise<SellerProfile> {
    const updated = await this.repo.updateSellerProfile(sellerProfileId, input as UpdateSellerProfileInput);
    await writeAuditLog(adminId, 'SELLER_RATED', 'SellerProfile', sellerProfileId, input);
    return updated;
  }
}

/** Strips admin-only fields before a seller profile is returned to its seller. */
function withoutInternal<T extends { internalRating?: number | null; internalNotes?: string | null }>(
  profile: T,
): Omit<T, 'internalRating' | 'internalNotes'> {
  const { internalRating: _r, internalNotes: _n, ...rest } = profile;
  return rest;
}

export const sellersService = new SellersService();
