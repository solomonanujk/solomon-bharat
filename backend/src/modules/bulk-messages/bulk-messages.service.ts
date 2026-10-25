import {
  BulkCampaign,
  BulkCampaignStatus,
  BulkRecipientStatus,
  BulkTemplate,
  BulkTemplateStatus,
} from '@prisma/client';
import { env } from '../../config/env';
import {
  InboundMessage,
  SendResult,
  StatusUpdate,
  TemplateStatusUpdate,
  WhatsAppProvider,
  WhatsAppSendError,
  normalizeWhatsAppNumber,
  whatsAppProvider,
} from '../../providers/whatsapp';
import {
  MetaTemplateClient,
  MetaTemplateError,
  TemplateButton,
  TemplateDefinition,
  countPlaceholders,
  parseMetaTemplate,
} from '../../providers/whatsapp/metaTemplates';
import { writeAuditLog } from '../../utils/auditLog';
import { buildCsv } from '../../utils/csv';
import { AppError } from '../../utils/errors';
import { PaginationQuery } from '../../utils/pagination';
import { SkippedCounts, buildVariables, resolveAudience } from './bulk-messages.audience';
import { BulkMessagesRepository, CampaignWithTemplate } from './bulk-messages.repository';
import {
  AudienceSpec,
  CampaignInputDto,
  TemplateInputDto,
  TestSendDto,
  templateContentIssues,
} from './bulk-messages.validation';

export type AuditWriter = typeof writeAuditLog;

/** How long a seller's reply to a bulk message stays visible to admin. */
export const REPLY_RETENTION_DAYS = 90;
/** A reply counts as an answer to a broadcast for this long after the message was sent. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const EXPORT_ROW_CAP = 20_000;
const SAMPLE_SIZE = 5;

export interface BulkMessagesDeps {
  /** The Meta template API client, or null when the WABA id or token is not configured. */
  templateClient: () => MetaTemplateClient | null;
  provider: WhatsAppProvider;
  audit: AuditWriter;
  maxRecipients: number;
}

export function createTemplateClient(): MetaTemplateClient | null {
  if (!env.META_WABA_ID || !env.META_WHATSAPP_ACCESS_TOKEN) return null;
  return new MetaTemplateClient({
    accessToken: env.META_WHATSAPP_ACCESS_TOKEN,
    wabaId: env.META_WABA_ID,
    graphVersion: env.META_GRAPH_VERSION,
  });
}

const defaultDeps = (): BulkMessagesDeps => ({
  templateClient: createTemplateClient,
  provider: whatsAppProvider,
  audit: writeAuditLog,
  maxRecipients: env.BULK_MAX_RECIPIENTS,
});

/** Meta's review states mapped onto ours; anything unknown leaves the stored status alone. */
export function mapMetaStatus(status: string): BulkTemplateStatus | null {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'REINSTATED':
      return BulkTemplateStatus.APPROVED;
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return BulkTemplateStatus.PENDING;
    case 'REJECTED':
      return BulkTemplateStatus.REJECTED;
    case 'PAUSED':
    case 'FLAGGED':
      return BulkTemplateStatus.PAUSED;
    case 'DISABLED':
      return BulkTemplateStatus.DISABLED;
    default:
      return null;
  }
}

const statusCountsToSummary = (counts: Partial<Record<BulkRecipientStatus, number>> = {}) => {
  const n = (s: BulkRecipientStatus): number => counts[s] ?? 0;
  return {
    queued: n('QUEUED') + n('SENDING'),
    sent: n('SENT'),
    delivered: n('DELIVERED'),
    read: n('READ'),
    failed: n('FAILED'),
    /** Everything Meta accepted: sent, delivered or read. */
    accepted: n('SENT') + n('DELIVERED') + n('READ'),
  };
};

export type CampaignSummary = ReturnType<typeof statusCountsToSummary>;

function toDefinition(t: BulkTemplate): TemplateDefinition {
  return {
    name: t.name,
    category: t.category,
    language: t.language,
    headerText: t.headerText,
    body: t.body,
    footer: t.footer,
    buttons: (t.buttons as TemplateButton[] | null) ?? null,
    variableExamples: (t.variableExamples as string[]) ?? [],
  };
}

export class BulkMessagesService {
  private readonly deps: BulkMessagesDeps;

  constructor(
    private readonly repo: BulkMessagesRepository = new BulkMessagesRepository(),
    deps: Partial<BulkMessagesDeps> = {},
  ) {
    this.deps = { ...defaultDeps(), ...deps };
  }

  // ── templates ─────────────────────────────────────────────────────────────────────────────

  async createTemplate(adminId: string, dto: TemplateInputDto): Promise<BulkTemplate> {
    if (await this.repo.findTemplateByNameAndLanguage(dto.name, dto.language)) {
      throw AppError.conflict('A template with this name and language already exists');
    }
    return this.repo.createTemplate({
      name: dto.name,
      category: dto.category,
      language: dto.language,
      headerText: dto.headerText || null,
      body: dto.body,
      footer: dto.footer || null,
      buttons: dto.buttons && dto.buttons.length > 0 ? (dto.buttons as never) : undefined,
      variableExamples: dto.variableExamples as never,
      createdById: adminId,
    });
  }

  async updateTemplate(id: string, dto: TemplateInputDto): Promise<BulkTemplate> {
    const template = await this.getTemplate(id);
    if (template.status !== BulkTemplateStatus.DRAFT) {
      throw AppError.conflict('Only a draft template can be edited. Make a copy under a new name instead.');
    }
    const clash = await this.repo.findTemplateByNameAndLanguage(dto.name, dto.language);
    if (clash && clash.id !== id) throw AppError.conflict('A template with this name and language already exists');
    return this.repo.updateTemplate(id, {
      name: dto.name,
      category: dto.category,
      language: dto.language,
      headerText: dto.headerText || null,
      body: dto.body,
      footer: dto.footer || null,
      buttons: dto.buttons && dto.buttons.length > 0 ? (dto.buttons as never) : undefined,
      variableExamples: dto.variableExamples as never,
    });
  }

  async getTemplate(id: string): Promise<BulkTemplate> {
    const template = await this.repo.findTemplate(id);
    if (!template) throw AppError.notFound('Template not found');
    return template;
  }

  listTemplates(filter: { status?: BulkTemplateStatus }, pagination: PaginationQuery) {
    return this.repo.findTemplates(filter, pagination);
  }

  private requireClient(): MetaTemplateClient {
    const client = this.deps.templateClient();
    if (!client) {
      throw new AppError(
        503,
        'Meta template access is not set up. Add META_WABA_ID and an access token with the whatsapp_business_management permission.',
      );
    }
    return client;
  }

  private metaFailure(err: unknown): never {
    if (err instanceof MetaTemplateError) {
      throw new AppError(err.status >= 500 ? 502 : 400, err.message);
    }
    throw err;
  }

  async submitTemplate(adminId: string, id: string): Promise<BulkTemplate> {
    const template = await this.getTemplate(id);
    if (template.status !== BulkTemplateStatus.DRAFT) {
      throw AppError.conflict('This template was already submitted');
    }
    const issues = templateContentIssues({
      headerText: template.headerText,
      body: template.body,
      variableExamples: (template.variableExamples as string[]) ?? [],
    });
    if (issues.length > 0) throw AppError.badRequest(issues[0], { issues });

    const client = this.requireClient();
    let info;
    try {
      info = await client.create(toDefinition(template));
    } catch (err) {
      this.metaFailure(err);
    }
    const updated = await this.repo.updateTemplate(id, {
      metaTemplateId: info.id,
      status: mapMetaStatus(info.status) ?? BulkTemplateStatus.PENDING,
      rejectionReason: null,
    });
    await this.deps.audit(adminId, 'BULK_TEMPLATE_SUBMITTED', 'BulkTemplate', id, { name: template.name, category: template.category });
    return updated;
  }

  /** Asks Meta for the template's current review status. */
  async refreshTemplate(id: string): Promise<BulkTemplate> {
    const template = await this.getTemplate(id);
    if (!template.metaTemplateId) return template;
    const client = this.requireClient();
    let info;
    try {
      info = await client.get(template.metaTemplateId);
    } catch (err) {
      this.metaFailure(err);
    }
    const status = mapMetaStatus(info.status);
    if (!status) return template;
    return this.repo.updateTemplate(id, {
      status,
      rejectionReason: status === BulkTemplateStatus.REJECTED ? info.rejectedReason ?? 'Rejected by Meta' : null,
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.getTemplate(id);
    if ((await this.repo.countCampaignsForTemplate(id)) > 0) {
      throw AppError.conflict('This template was used in a campaign and cannot be deleted');
    }
    // A template pulled in from Meta belongs to the WhatsApp Manager: removing it here only removes it from
    // this list (Sync from Meta would bring it back), it is never deleted at Meta.
    if (template.metaTemplateId && !template.syncedFromMeta) {
      const client = this.deps.templateClient();
      if (client) {
        try {
          await client.remove(template.name);
        } catch (err) {
          this.metaFailure(err);
        }
      }
    }
    await this.repo.deleteTemplate(id);
  }

  /**
   * Pulls the templates already on the WhatsApp Business Account (created in WhatsApp Manager, or Meta's own
   * `hello_world`) into the list, so approved ones can be used in a campaign. Templates our sender cannot
   * fill in (media header, variable link, named variables, authentication) are left out and reported.
   * Re-running it refreshes the status of templates already imported or submitted from here.
   */
  async syncTemplates(adminId: string): Promise<{
    created: number;
    updated: number;
    unchanged: number;
    skipped: { name: string; language: string; reason: string }[];
  }> {
    const client = this.requireClient();
    let raws;
    try {
      raws = await client.list();
    } catch (err) {
      this.metaFailure(err);
    }

    const result = { created: 0, updated: 0, unchanged: 0, skipped: [] as { name: string; language: string; reason: string }[] };
    for (const raw of raws) {
      const parsed = parseMetaTemplate(raw);
      if (!parsed.ok) {
        result.skipped.push({ name: raw.name ?? 'unknown', language: raw.language ?? '', reason: parsed.reason });
        continue;
      }
      const { metaTemplateId, definition: d } = parsed.value;
      const status = mapMetaStatus(parsed.value.status) ?? BulkTemplateStatus.PENDING;
      const rejectionReason = status === BulkTemplateStatus.REJECTED ? parsed.value.rejectedReason ?? 'Rejected by Meta' : null;

      const existing =
        (await this.repo.findTemplateByMetaId(metaTemplateId)) ?? (await this.repo.findTemplateByNameAndLanguage(d.name, d.language));
      if (existing) {
        if (!existing.metaTemplateId && !existing.syncedFromMeta) {
          result.skipped.push({ name: d.name, language: d.language, reason: 'a draft with this name already exists here' });
          continue;
        }
        if (existing.status === status && existing.rejectionReason === rejectionReason && existing.metaTemplateId === metaTemplateId) {
          result.unchanged += 1;
          continue;
        }
        await this.repo.updateTemplate(existing.id, { status, rejectionReason, metaTemplateId });
        result.updated += 1;
        continue;
      }
      await this.repo.createTemplate({
        name: d.name,
        category: d.category,
        language: d.language,
        headerText: d.headerText ?? null,
        body: d.body,
        footer: d.footer ?? null,
        buttons: d.buttons && d.buttons.length > 0 ? (d.buttons as never) : undefined,
        variableExamples: d.variableExamples as never,
        metaTemplateId,
        status,
        rejectionReason,
        syncedFromMeta: true,
        createdById: adminId,
      });
      result.created += 1;
    }

    await this.deps.audit(adminId, 'BULK_TEMPLATES_SYNCED', 'BulkTemplate', 'sync', {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped.length,
    });
    return result;
  }

  /** Meta's `message_template_status_update` webhook. */
  async applyTemplateStatus(update: TemplateStatusUpdate): Promise<void> {
    const template = await this.repo.findTemplateByMetaId(update.metaTemplateId);
    if (!template) return;
    const status = mapMetaStatus(update.event);
    if (!status) return;
    await this.repo.updateTemplate(template.id, {
      status,
      rejectionReason: status === BulkTemplateStatus.REJECTED ? update.reason ?? 'Rejected by Meta' : null,
    });
  }

  // ── audience ──────────────────────────────────────────────────────────────────────────────

  private async resolve(spec: AudienceSpec) {
    return resolveAudience(await this.repo.findAudienceCandidates(spec), spec);
  }

  async previewAudience(spec: AudienceSpec) {
    const { recipients, skipped } = await this.resolve(spec);
    return {
      eligible: recipients.length,
      skipped,
      tooMany: recipients.length > this.deps.maxRecipients,
      maxRecipients: this.deps.maxRecipients,
      sample: recipients.slice(0, SAMPLE_SIZE).map((r) => ({
        sellerId: r.sellerId,
        businessName: r.businessName,
        contactName: r.contactName,
        phone: r.phone,
      })),
    };
  }

  // ── campaigns ─────────────────────────────────────────────────────────────────────────────

  async createCampaign(adminId: string, dto: CampaignInputDto): Promise<BulkCampaign> {
    const template = await this.getTemplate(dto.templateId);
    if (template.status !== BulkTemplateStatus.APPROVED) {
      throw AppError.badRequest('Only an approved template can be sent');
    }
    const placeholders = countPlaceholders(template.body);
    if (dto.variableMapping.length !== placeholders) {
      throw AppError.badRequest(
        `This template has ${placeholders} variable${placeholders === 1 ? '' : 's'}; choose a value for each (got ${dto.variableMapping.length})`,
      );
    }
    const usesCsv = dto.variableMapping.some((m) => m.startsWith('csv:'));
    if (usesCsv) {
      if (dto.audience.mode !== 'CSV') throw AppError.badRequest('A CSV column can only be used with a CSV audience');
      const columns = new Set(Object.keys(dto.audience.csvRows?.[0] ?? {}));
      for (const m of dto.variableMapping) {
        if (m.startsWith('csv:') && !columns.has(m.slice(4))) throw AppError.badRequest(`The CSV has no column "${m.slice(4)}"`);
      }
    }

    const { recipients, skipped } = await this.resolve(dto.audience);
    if (recipients.length === 0) throw AppError.badRequest('No eligible sellers in this audience');
    if (recipients.length > this.deps.maxRecipients) {
      throw AppError.badRequest(`This audience has ${recipients.length} sellers; one campaign can send to at most ${this.deps.maxRecipients}`);
    }

    const campaign = await this.repo.createCampaign(
      {
        name: dto.name,
        templateId: template.id,
        status: BulkCampaignStatus.DRAFT,
        audience: { ...dto.audience, csvRows: undefined } as never,
        variableMapping: dto.variableMapping as never,
        totalCount: recipients.length,
        skippedCount: Object.values(skipped).reduce((a, b) => a + b, 0),
        createdById: adminId,
      },
      recipients.map((r) => ({ sellerId: r.sellerId, phone: r.phone, variables: buildVariables(dto.variableMapping, r) })),
    );
    return campaign;
  }

  async getCampaign(id: string) {
    const campaign = await this.repo.findCampaign(id);
    if (!campaign) throw AppError.notFound('Campaign not found');
    const counts = await this.repo.statusCounts([id]);
    return { ...campaign, summary: statusCountsToSummary(counts[id]) };
  }

  async listCampaigns(filter: { status?: BulkCampaignStatus }, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findCampaigns(filter, pagination);
    const counts = await this.repo.statusCounts(data.map((c) => c.id));
    return { data: data.map((c) => ({ ...c, summary: statusCountsToSummary(counts[c.id]) })), total };
  }

  listRecipients(id: string, filter: { status?: BulkRecipientStatus }, pagination: PaginationQuery) {
    return this.repo.findRecipients(id, filter, pagination);
  }

  private async changeStatus(
    adminId: string,
    id: string,
    from: BulkCampaignStatus[],
    to: BulkCampaignStatus,
    action: string,
  ): Promise<CampaignWithTemplate> {
    const campaign = await this.repo.findCampaign(id);
    if (!campaign) throw AppError.notFound('Campaign not found');
    if (!from.includes(campaign.status)) {
      throw AppError.conflict(`A campaign that is ${campaign.status.toLowerCase()} cannot be changed that way`);
    }
    if (to === BulkCampaignStatus.RUNNING && campaign.template.status !== BulkTemplateStatus.APPROVED) {
      throw AppError.conflict('This template is no longer approved by Meta, so the campaign cannot run');
    }
    const now = new Date();
    await this.repo.updateCampaign(id, {
      status: to,
      ...(to === BulkCampaignStatus.RUNNING && !campaign.startedAt ? { startedAt: now } : {}),
      ...(to === BulkCampaignStatus.CANCELLED ? { completedAt: now } : {}),
    });
    if (to === BulkCampaignStatus.CANCELLED) await this.repo.failOpenRecipients(id, 'Campaign cancelled');
    await this.deps.audit(adminId, action, 'BulkCampaign', id, { totalCount: campaign.totalCount, template: campaign.template.name });
    return { ...campaign, status: to };
  }

  start(adminId: string, id: string) {
    return this.changeStatus(adminId, id, [BulkCampaignStatus.DRAFT], BulkCampaignStatus.RUNNING, 'BULK_CAMPAIGN_STARTED');
  }

  pause(adminId: string, id: string) {
    return this.changeStatus(adminId, id, [BulkCampaignStatus.RUNNING], BulkCampaignStatus.PAUSED, 'BULK_CAMPAIGN_PAUSED');
  }

  resume(adminId: string, id: string) {
    return this.changeStatus(adminId, id, [BulkCampaignStatus.PAUSED], BulkCampaignStatus.RUNNING, 'BULK_CAMPAIGN_RESUMED');
  }

  cancel(adminId: string, id: string) {
    return this.changeStatus(
      adminId,
      id,
      [BulkCampaignStatus.DRAFT, BulkCampaignStatus.RUNNING, BulkCampaignStatus.PAUSED],
      BulkCampaignStatus.CANCELLED,
      'BULK_CAMPAIGN_CANCELLED',
    );
  }

  async exportCampaign(adminId: string, id: string): Promise<{ csv: string; filename: string; rows: number }> {
    const campaign = await this.repo.findCampaign(id);
    if (!campaign) throw AppError.notFound('Campaign not found');
    const rows = await this.repo.findRecipientsForExport(id, EXPORT_ROW_CAP);
    const csv = buildCsv(
      ['Seller', 'WhatsApp number', 'Status', 'Sent at', 'Delivered at', 'Read at', 'Error code', 'Error'],
      rows.map((r) => [
        r.seller.businessName,
        r.phone,
        r.status,
        r.sentAt?.toISOString() ?? '',
        r.deliveredAt?.toISOString() ?? '',
        r.readAt?.toISOString() ?? '',
        r.errorCode ?? '',
        r.errorMessage ?? '',
      ]),
    );
    await this.deps.audit(adminId, 'BULK_CAMPAIGN_EXPORTED', 'BulkCampaign', id, { rows: rows.length });
    return { csv, filename: `bulk-campaign-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`, rows: rows.length };
  }

  /** Sends one approved template to one number, to check the wording before a real send. */
  async testSend(dto: TestSendDto): Promise<SendResult> {
    const template = await this.getTemplate(dto.templateId);
    if (template.status !== BulkTemplateStatus.APPROVED) throw AppError.badRequest('Only an approved template can be sent');
    const phone = normalizeWhatsAppNumber(dto.phone);
    if (!phone) throw AppError.badRequest('Enter the number with its country code, for example +919812345678');
    const placeholders = countPlaceholders(template.body);
    if (dto.variables.length !== placeholders) {
      throw AppError.badRequest(`This template has ${placeholders} variable${placeholders === 1 ? '' : 's'}`);
    }
    if (!this.deps.provider.sendTemplate) throw new AppError(503, 'WhatsApp sending is not set up');
    try {
      return (
        (await this.deps.provider.sendTemplate(phone, {
          name: template.name,
          language: template.language,
          body: dto.variables,
        })) ?? {}
      );
    } catch (err) {
      if (err instanceof WhatsAppSendError) throw new AppError(err.transient ? 502 : 400, err.message);
      throw err;
    }
  }

  // ── replies ───────────────────────────────────────────────────────────────────────────────

  listReplies(filter: { campaignId?: string; unread?: boolean }, pagination: PaginationQuery) {
    return this.repo.findReplies(filter, pagination);
  }

  async unreadReplyCount(): Promise<number> {
    return this.repo.countUnreadReplies();
  }

  markReplyRead(id: string) {
    return this.repo.markReplyRead(id);
  }

  markAllRepliesRead(campaignId?: string) {
    return this.repo.markAllRepliesRead(campaignId);
  }

  // ── hooks used by the WhatsApp module ─────────────────────────────────────────────────────

  /** Delivery receipts from the webhook. */
  async recordStatuses(updates: StatusUpdate[]): Promise<void> {
    for (const u of updates) {
      await this.repo.applyStatus(u.providerMessageId, u.status, { code: u.errorCode, message: u.errorMessage });
    }
  }

  /**
   * A message from a seller who was sent a bulk message in the last 24 hours. Saves it for admin and
   * says whether this is their first reply to that campaign (so the bot acknowledges only once).
   * Returns null when no bulk message was sent to this number recently.
   */
  async recordReply(message: InboundMessage): Promise<{ firstReply: boolean } | null> {
    const recipient = await this.repo.findRecentRecipientByPhone(message.from, new Date(Date.now() - REPLY_WINDOW_MS));
    if (!recipient) return null;
    const firstReply = (await this.repo.hasReplyFor(recipient.id)) === 0;
    const type = message.media.length > 0 ? 'media' : 'text';
    await this.repo.createReply({
      recipientId: recipient.id,
      campaignId: recipient.campaignId,
      sellerId: recipient.sellerId,
      phone: message.from,
      type,
      text: message.body ? message.body.slice(0, 1000) : null,
      providerMessageId: message.providerMessageId,
    });
    return { firstReply };
  }

  /** True when a bulk message went to this number in the last 24 hours. */
  async hasRecentBulkMessage(phone: string): Promise<boolean> {
    return (await this.repo.findRecentRecipientByPhone(phone, new Date(Date.now() - REPLY_WINDOW_MS))) !== null;
  }

  setOptOut(sellerId: string, optedOut: boolean): Promise<void> {
    return this.repo.setOptedOut(sellerId, optedOut);
  }
}

export const bulkMessagesService = new BulkMessagesService();
export type { SkippedCounts };
