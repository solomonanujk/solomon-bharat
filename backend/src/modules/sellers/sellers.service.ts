import { SellerApplication, SellerApplicationStatus, SellerProfile } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { hashPassword } from '../../utils/bcrypt';
import { generateTempPassword } from '../../utils/helpers';
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

  async submitApplication(input: SubmitApplicationInput): Promise<SellerApplication> {
    const existingUser = await this.repo.findUserByEmail(input.email);
    if (existingUser) {
      throw AppError.conflict('An account already exists for this email address');
    }

    const latest = await this.repo.findLatestApplicationByEmail(input.email);
    if (latest && OPEN_APPLICATION_STATUSES.includes(latest.status)) {
      throw AppError.conflict('An application for this email is already under review');
    }

    return this.repo.createApplication(input);
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

    await mailProvider.sendMail({
      to: user.email,
      subject: 'Your Solomon Bharat seller account is ready',
      html: `<p>Congratulations — your seller application has been approved.</p>
<p>You can now log in to the Seller Portal at <a href="${env.APP_URL}/login">${env.APP_URL}/login</a> with:</p>
<p>Email: ${user.email}<br/>Temporary password: <strong>${tempPassword}</strong></p>
<p>Please change your password after your first login.</p>`,
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

  async getMyProfile(userId: string): Promise<SellerProfile> {
    const profile = await this.repo.findSellerProfileByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Seller profile not found');
    }
    return profile;
  }

  async updateMyProfile(userId: string, input: UpdateSellerProfileInput): Promise<SellerProfile> {
    const profile = await this.getMyProfile(userId);
    return this.repo.updateSellerProfile(profile.id, input);
  }
}

export const sellersService = new SellersService();
