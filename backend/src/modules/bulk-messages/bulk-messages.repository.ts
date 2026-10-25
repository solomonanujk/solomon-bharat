import {
  BulkCampaign,
  BulkCampaignStatus,
  BulkRecipient,
  BulkRecipientStatus,
  BulkReply,
  BulkTemplate,
  BulkTemplateStatus,
  Prisma,
  PrismaClient,
  ProductSource,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { AudienceCandidate, csvLookupKeys } from './bulk-messages.audience';
import { AudienceSpec } from './bulk-messages.validation';

export type CampaignWithTemplate = BulkCampaign & { template: BulkTemplate };
export type RecipientWithSeller = BulkRecipient & { seller: { businessName: string; whatsappOptedOutAt: Date | null } };
export type ReplyWithSeller = BulkReply & {
  recipient: { seller: { businessName: string } };
  campaign: { name: string };
};

const AUDIENCE_SELECT = {
  id: true,
  businessName: true,
  contactName: true,
  phone: true,
  whatsappNumber: true,
  whatsappOptedOutAt: true,
  user: { select: { email: true, status: true } },
} satisfies Prisma.SellerProfileSelect;

/** Safety net: the most sellers one audience query ever reads. */
const AUDIENCE_READ_CAP = 20_000;

const RANK: Record<BulkRecipientStatus, number> = {
  QUEUED: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 2,
};

export class BulkMessagesRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  // ── templates ─────────────────────────────────────────────────────────────────────────────

  createTemplate(data: Prisma.BulkTemplateUncheckedCreateInput): Promise<BulkTemplate> {
    return this.db.bulkTemplate.create({ data });
  }

  findTemplate(id: string): Promise<BulkTemplate | null> {
    return this.db.bulkTemplate.findUnique({ where: { id } });
  }

  findTemplateByNameAndLanguage(name: string, language: string): Promise<BulkTemplate | null> {
    return this.db.bulkTemplate.findUnique({ where: { name_language: { name, language } } });
  }

  findTemplateByMetaId(metaTemplateId: string): Promise<BulkTemplate | null> {
    return this.db.bulkTemplate.findFirst({ where: { metaTemplateId } });
  }

  async findTemplates(
    filter: { status?: BulkTemplateStatus },
    pagination: PaginationQuery,
  ): Promise<{ data: BulkTemplate[]; total: number }> {
    const where: Prisma.BulkTemplateWhereInput = filter.status ? { status: filter.status } : {};
    const [data, total] = await Promise.all([
      this.db.bulkTemplate.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
      this.db.bulkTemplate.count({ where }),
    ]);
    return { data, total };
  }

  updateTemplate(id: string, data: Prisma.BulkTemplateUncheckedUpdateInput): Promise<BulkTemplate> {
    return this.db.bulkTemplate.update({ where: { id }, data });
  }

  deleteTemplate(id: string): Promise<BulkTemplate> {
    return this.db.bulkTemplate.delete({ where: { id } });
  }

  countCampaignsForTemplate(templateId: string): Promise<number> {
    return this.db.bulkCampaign.count({ where: { templateId } });
  }

  // ── audience ──────────────────────────────────────────────────────────────────────────────

  /** The registered sellers an audience spec points at, before eligibility is applied. */
  findAudienceCandidates(spec: AudienceSpec): Promise<AudienceCandidate[]> {
    const where: Prisma.SellerProfileWhereInput = { deletedAt: null };

    if (spec.mode === 'PICKED') {
      where.id = { in: spec.sellerIds ?? [] };
    } else if (spec.mode === 'FILTERED') {
      const f = spec.filters ?? {};
      if (f.sellerType) where.sellerType = f.sellerType;
      if (f.listedByChat) where.products = { some: { source: ProductSource.WHATSAPP, deletedAt: null } };
      if (f.search) {
        where.OR = [
          { businessName: { contains: f.search, mode: 'insensitive' } },
          { contactName: { contains: f.search, mode: 'insensitive' } },
        ];
      }
    } else if (spec.mode === 'CSV') {
      const keys = new Set<string>();
      for (const row of spec.csvRows ?? []) {
        for (const key of csvLookupKeys(row[spec.csvKeyColumn ?? ''] ?? '')) keys.add(key);
      }
      const all = [...keys];
      const emails = all.filter((k) => k.includes('@'));
      const phones = all.filter((k) => !k.includes('@'));
      // A registered phone is stored as typed, so match both the normalised and the bare-digits forms.
      const phoneForms = phones.flatMap((p) => [p, p.replace(/^\+/, ''), p.replace(/^\+91/, '')]);
      where.OR = [
        { whatsappNumber: { in: phones } },
        { phone: { in: phoneForms } },
        { user: { email: { in: emails, mode: 'insensitive' } } },
      ];
    }
    return this.db.sellerProfile.findMany({ where, select: AUDIENCE_SELECT, orderBy: { createdAt: 'asc' }, take: AUDIENCE_READ_CAP });
  }

  // ── campaigns ─────────────────────────────────────────────────────────────────────────────

  async createCampaign(
    data: Prisma.BulkCampaignUncheckedCreateInput,
    recipients: { sellerId: string; phone: string; variables: string[] }[],
  ): Promise<BulkCampaign> {
    return this.db.$transaction(async (tx) => {
      const campaign = await tx.bulkCampaign.create({ data });
      if (recipients.length > 0) {
        await tx.bulkRecipient.createMany({
          data: recipients.map((r) => ({
            campaignId: campaign.id,
            sellerId: r.sellerId,
            phone: r.phone,
            variables: r.variables as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      return campaign;
    });
  }

  findCampaign(id: string): Promise<CampaignWithTemplate | null> {
    return this.db.bulkCampaign.findUnique({ where: { id }, include: { template: true } });
  }

  async findCampaigns(
    filter: { status?: BulkCampaignStatus },
    pagination: PaginationQuery,
  ): Promise<{ data: CampaignWithTemplate[]; total: number }> {
    const where: Prisma.BulkCampaignWhereInput = filter.status ? { status: filter.status } : {};
    const [data, total] = await Promise.all([
      this.db.bulkCampaign.findMany({
        where,
        include: { template: true },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.bulkCampaign.count({ where }),
    ]);
    return { data, total };
  }

  updateCampaign(id: string, data: Prisma.BulkCampaignUncheckedUpdateInput): Promise<BulkCampaign> {
    return this.db.bulkCampaign.update({ where: { id }, data });
  }

  /** Campaigns the runner should be working on, oldest first. */
  findRunningCampaigns(): Promise<CampaignWithTemplate[]> {
    return this.db.bulkCampaign.findMany({
      where: { status: BulkCampaignStatus.RUNNING },
      include: { template: true },
      orderBy: { startedAt: 'asc' },
    });
  }

  /** Recipient counts by status for one or several campaigns: `{ [campaignId]: { QUEUED: 3, SENT: 10 } }`. */
  async statusCounts(campaignIds: string[]): Promise<Record<string, Partial<Record<BulkRecipientStatus, number>>>> {
    if (campaignIds.length === 0) return {};
    const rows = await this.db.bulkRecipient.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    });
    const result: Record<string, Partial<Record<BulkRecipientStatus, number>>> = {};
    for (const row of rows) {
      (result[row.campaignId] ??= {})[row.status] = row._count._all;
    }
    return result;
  }

  // ── recipients ────────────────────────────────────────────────────────────────────────────

  async findRecipients(
    campaignId: string,
    filter: { status?: BulkRecipientStatus },
    pagination: PaginationQuery,
  ): Promise<{ data: RecipientWithSeller[]; total: number }> {
    const where: Prisma.BulkRecipientWhereInput = { campaignId, ...(filter.status ? { status: filter.status } : {}) };
    const [data, total] = await Promise.all([
      this.db.bulkRecipient.findMany({
        where,
        include: { seller: { select: { businessName: true, whatsappOptedOutAt: true } } },
        orderBy: { createdAt: 'asc' },
        ...toSkipTake(pagination),
      }),
      this.db.bulkRecipient.count({ where }),
    ]);
    return { data, total };
  }

  /** Every recipient of a campaign for the CSV export, capped. */
  findRecipientsForExport(campaignId: string, limit: number): Promise<RecipientWithSeller[]> {
    return this.db.bulkRecipient.findMany({
      where: { campaignId },
      include: { seller: { select: { businessName: true, whatsappOptedOutAt: true } } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /** Takes up to `limit` queued recipients of a campaign and marks them SENDING (one more attempt each). */
  async claimBatch(campaignId: string, limit: number): Promise<RecipientWithSeller[]> {
    return this.db.$transaction(async (tx) => {
      const queued = await tx.bulkRecipient.findMany({
        where: { campaignId, status: BulkRecipientStatus.QUEUED },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      if (queued.length === 0) return [];
      const ids = queued.map((r) => r.id);
      await tx.bulkRecipient.updateMany({
        where: { id: { in: ids }, status: BulkRecipientStatus.QUEUED },
        data: { status: BulkRecipientStatus.SENDING, attempts: { increment: 1 } },
      });
      return tx.bulkRecipient.findMany({
        where: { id: { in: ids }, status: BulkRecipientStatus.SENDING },
        include: { seller: { select: { businessName: true, whatsappOptedOutAt: true } } },
      });
    });
  }

  markSent(id: string, providerMessageId?: string): Promise<BulkRecipient> {
    return this.db.bulkRecipient.update({
      where: { id },
      data: { status: BulkRecipientStatus.SENT, sentAt: new Date(), providerMessageId: providerMessageId ?? null, errorCode: null, errorMessage: null },
    });
  }

  markFailed(id: string, errorCode: number | undefined, errorMessage: string): Promise<BulkRecipient> {
    return this.db.bulkRecipient.update({
      where: { id },
      data: { status: BulkRecipientStatus.FAILED, errorCode: errorCode ?? null, errorMessage: errorMessage.slice(0, 500) },
    });
  }

  requeue(id: string): Promise<BulkRecipient> {
    return this.db.bulkRecipient.update({ where: { id }, data: { status: BulkRecipientStatus.QUEUED } });
  }

  /** After a crash or deploy: recipients stuck mid-send go back in the queue. */
  async resetStaleSending(): Promise<number> {
    const res = await this.db.bulkRecipient.updateMany({
      where: { status: BulkRecipientStatus.SENDING },
      data: { status: BulkRecipientStatus.QUEUED },
    });
    return res.count;
  }

  /** Recipients still waiting or in flight; zero means the campaign has finished. */
  countOpen(campaignId: string): Promise<number> {
    return this.db.bulkRecipient.count({
      where: { campaignId, status: { in: [BulkRecipientStatus.QUEUED, BulkRecipientStatus.SENDING] } },
    });
  }

  /** Cancelling or finishing: anything not yet sent is marked failed with the reason. */
  async failOpenRecipients(campaignId: string, reason: string): Promise<number> {
    const res = await this.db.bulkRecipient.updateMany({
      where: { campaignId, status: { in: [BulkRecipientStatus.QUEUED, BulkRecipientStatus.SENDING] } },
      data: { status: BulkRecipientStatus.FAILED, errorMessage: reason },
    });
    return res.count;
  }

  /**
   * Applies a delivery receipt. Receipts can arrive out of order, so a status only ever moves forward
   * (sent, delivered, read); a failure receipt is accepted unless the message was already delivered.
   * Returns false when no recipient has that message id or the receipt is stale.
   */
  async applyStatus(
    providerMessageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    error?: { code?: number; message?: string },
  ): Promise<boolean> {
    const recipient = await this.db.bulkRecipient.findFirst({ where: { providerMessageId } });
    if (!recipient) return false;

    const next: BulkRecipientStatus = status.toUpperCase() as BulkRecipientStatus;
    if (next === BulkRecipientStatus.FAILED) {
      if (RANK[recipient.status] >= RANK.DELIVERED) return false;
      await this.db.bulkRecipient.update({
        where: { id: recipient.id },
        data: { status: next, errorCode: error?.code ?? null, errorMessage: error?.message?.slice(0, 500) ?? null },
      });
      return true;
    }
    if (recipient.status === BulkRecipientStatus.FAILED ? false : RANK[next] <= RANK[recipient.status]) return false;

    const now = new Date();
    await this.db.bulkRecipient.update({
      where: { id: recipient.id },
      data: {
        status: next,
        errorCode: null,
        errorMessage: null,
        ...(next === BulkRecipientStatus.DELIVERED ? { deliveredAt: now } : {}),
        ...(next === BulkRecipientStatus.READ ? { readAt: now, deliveredAt: recipient.deliveredAt ?? now } : {}),
      },
    });
    return true;
  }

  // ── replies ───────────────────────────────────────────────────────────────────────────────

  /** The newest bulk message sent to this number since `since`, if any. */
  findRecentRecipientByPhone(phone: string, since: Date): Promise<BulkRecipient | null> {
    return this.db.bulkRecipient.findFirst({
      where: { phone, sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
    });
  }

  /** True when this seller already got an acknowledgement for this campaign. */
  hasReplyFor(recipientId: string): Promise<number> {
    return this.db.bulkReply.count({ where: { recipientId } });
  }

  /** Stores a reply; a repeated delivery of the same message id is ignored (returns null). */
  async createReply(data: Prisma.BulkReplyUncheckedCreateInput): Promise<BulkReply | null> {
    try {
      return await this.db.bulkReply.create({ data });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') return null;
      throw err;
    }
  }

  async findReplies(
    filter: { campaignId?: string; unread?: boolean },
    pagination: PaginationQuery,
  ): Promise<{ data: ReplyWithSeller[]; total: number }> {
    const where: Prisma.BulkReplyWhereInput = {
      ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
      ...(filter.unread ? { readByAdminAt: null } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.bulkReply.findMany({
        where,
        include: { recipient: { select: { seller: { select: { businessName: true } } } }, campaign: { select: { name: true } } },
        orderBy: { receivedAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.bulkReply.count({ where }),
    ]);
    return { data, total };
  }

  countUnreadReplies(): Promise<number> {
    return this.db.bulkReply.count({ where: { readByAdminAt: null } });
  }

  markReplyRead(id: string): Promise<BulkReply> {
    return this.db.bulkReply.update({ where: { id }, data: { readByAdminAt: new Date() } });
  }

  async markAllRepliesRead(campaignId?: string): Promise<number> {
    const res = await this.db.bulkReply.updateMany({
      where: { readByAdminAt: null, ...(campaignId ? { campaignId } : {}) },
      data: { readByAdminAt: new Date() },
    });
    return res.count;
  }

  /** Replies older than the retention period are deleted. */
  async deleteRepliesOlderThan(cutoff: Date): Promise<number> {
    const res = await this.db.bulkReply.deleteMany({ where: { receivedAt: { lt: cutoff } } });
    return res.count;
  }

  // ── opt-out ───────────────────────────────────────────────────────────────────────────────

  async setOptedOut(sellerId: string, optedOut: boolean): Promise<void> {
    await this.db.sellerProfile.update({
      where: { id: sellerId },
      data: { whatsappOptedOutAt: optedOut ? new Date() : null },
    });
  }
}
