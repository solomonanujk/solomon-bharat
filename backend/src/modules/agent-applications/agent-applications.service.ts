import { AgentApplication, AgentApplicationStatus, AgentProfile } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { hashPassword } from '../../utils/bcrypt';
import { generateTempPassword } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { SafeUser, toSafeUser } from '../../utils/safeUser';
import { mailProvider } from '../../providers/mail';
import { PaginationQuery } from '../../utils/pagination';
import { notificationsService } from '../notifications/notifications.service';
import { AgentApplicationsRepository, agentApplicationsRepository } from './agent-applications.repository';
import {
  AgentApplicationListFilter,
  SubmitAgentApplicationInput,
  UpdateAgentProfileInput,
} from './agent-applications.types';

const OPEN_APPLICATION_STATUSES: AgentApplicationStatus[] = [
  AgentApplicationStatus.PENDING,
  AgentApplicationStatus.MORE_INFO_REQUESTED,
];

function appendNote(existing: string | null, note: string): string {
  const stamped = `[${new Date().toISOString()}] ${note}`;
  return existing ? `${existing}\n${stamped}` : stamped;
}

export class AgentApplicationsService {
  constructor(private readonly repo: AgentApplicationsRepository = agentApplicationsRepository) {}

  private async getApplicationOrThrow(id: string): Promise<AgentApplication> {
    const application = await this.repo.findApplicationById(id);
    if (!application) {
      throw AppError.notFound('Agent application not found');
    }
    return application;
  }

  private assertApplicationIsOpen(application: AgentApplication): void {
    if (!OPEN_APPLICATION_STATUSES.includes(application.status)) {
      throw AppError.badRequest(
        `Application has already been ${application.status.toLowerCase()} and cannot be changed`,
      );
    }
  }

  async submitApplication(input: SubmitAgentApplicationInput): Promise<AgentApplication> {
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
    filter: AgentApplicationListFilter,
    pagination: PaginationQuery,
  ): Promise<{ data: AgentApplication[]; total: number }> {
    return this.repo.findApplications(filter, pagination);
  }

  async getApplicationDetail(id: string): Promise<AgentApplication> {
    return this.getApplicationOrThrow(id);
  }

  async approveApplication(
    id: string,
    adminId: string,
  ): Promise<{ user: SafeUser; profile: AgentProfile }> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const existingUser = await this.repo.findUserByEmail(application.email);
    if (existingUser) {
      throw AppError.conflict('An account already exists for this email address');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { user, profile } = await this.repo.createAgentUserAndProfile(application, passwordHash);

    await this.repo.updateApplication(id, {
      status: AgentApplicationStatus.APPROVED,
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await writeAuditLog(adminId, 'AGENT_APPLICATION_APPROVED', 'AgentApplication', id, {
      agentUserId: user.id,
    });

    await notificationsService.notifyAgentApplicationApproved(user.id);

    await mailProvider.sendMail({
      to: user.email,
      subject: 'Your Solomon Bharat agent account is ready',
      html: `<p>Congratulations — your agent application has been approved.</p>
<p>You can now sign in at <a href="${env.APP_URL}">${env.APP_URL}</a> — click "Sign In" in the top navigation — with:</p>
<p>Email: ${user.email}<br/>Temporary password: <strong>${tempPassword}</strong></p>
<p>Please change your password after your first login.</p>`,
    });

    return { user: toSafeUser(user), profile };
  }

  async rejectApplication(id: string, reason: string, adminId: string): Promise<AgentApplication> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const updated = await this.repo.updateApplication(id, {
      status: AgentApplicationStatus.REJECTED,
      rejectionReason: reason,
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await writeAuditLog(adminId, 'AGENT_APPLICATION_REJECTED', 'AgentApplication', id, { reason });

    await mailProvider.sendMail({
      to: application.email,
      subject: 'Update on your Solomon Bharat agent application',
      html: `<p>Thank you for applying to become an agent on Solomon Bharat. Unfortunately we're unable to move forward with your application at this time.</p><p>Reason: ${reason}</p>`,
    });

    return updated;
  }

  async requestMoreInfo(id: string, message: string, adminId: string): Promise<AgentApplication> {
    const application = await this.getApplicationOrThrow(id);
    this.assertApplicationIsOpen(application);

    const updated = await this.repo.updateApplication(id, {
      status: AgentApplicationStatus.MORE_INFO_REQUESTED,
      internalNotes: appendNote(application.internalNotes, `Requested more info: ${message}`),
      reviewedById: adminId,
      reviewedAt: new Date(),
    });

    await mailProvider.sendMail({
      to: application.email,
      subject: 'More information needed for your Solomon Bharat application',
      html: `<p>We need a bit more information to continue reviewing your agent application:</p><p>${message}</p><p>Please reply to this email with the requested details.</p>`,
    });

    return updated;
  }

  async addInternalNote(id: string, note: string): Promise<AgentApplication> {
    const application = await this.getApplicationOrThrow(id);
    return this.repo.updateApplication(id, {
      internalNotes: appendNote(application.internalNotes, note),
    });
  }

  async listAgents(pagination: PaginationQuery) {
    const { data, total } = await this.repo.findAgents(pagination);
    return { data: data.map(({ user, ...profile }) => ({ ...profile, user: toSafeUser(user) })), total };
  }

  async getAgentDetailForAdmin(id: string) {
    const agent = await this.repo.findAgentWithUserById(id);
    if (!agent) {
      throw AppError.notFound('Agent not found');
    }
    const { user, ...profile } = agent;
    return { ...profile, user: toSafeUser(user) };
  }

  async getMyProfile(userId: string): Promise<AgentProfile> {
    const profile = await this.repo.findAgentProfileByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Agent profile not found');
    }
    return profile;
  }

  async updateMyProfile(userId: string, input: UpdateAgentProfileInput): Promise<AgentProfile> {
    const profile = await this.getMyProfile(userId);
    return this.repo.updateAgentProfile(profile.id, input);
  }
}

export const agentApplicationsService = new AgentApplicationsService();
