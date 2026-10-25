import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppSendError } from '../../providers/whatsapp';
import { MetaTemplateError } from '../../providers/whatsapp/metaTemplates';
import { AppError } from '../../utils/errors';
import { BulkMessagesService, mapMetaStatus } from './bulk-messages.service';

const ADMIN = 'admin-1';

const template = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'festival_offer',
  category: 'MARKETING',
  language: 'en',
  headerText: null,
  body: 'Hello {{1}}, sale starts {{2}}. Reply to know more.',
  footer: null,
  buttons: null,
  variableExamples: ['Asha', 'Friday'],
  metaTemplateId: null,
  status: 'DRAFT',
  rejectionReason: null,
  ...over,
});

const candidate = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  businessName: `Biz ${id}`,
  contactName: `Contact ${id}`,
  phone: '+910000000000',
  whatsappNumber: `+91981234000${id}`,
  whatsappOptedOutAt: null,
  user: { email: `${id}@example.com`, status: 'ACTIVE' },
  ...over,
});

function build() {
  const repo = {
    findTemplate: vi.fn(),
    findTemplateByNameAndLanguage: vi.fn().mockResolvedValue(null),
    findTemplateByMetaId: vi.fn(),
    createTemplate: vi.fn().mockImplementation(async (d) => ({ id: 't-new', ...d })),
    updateTemplate: vi.fn().mockImplementation(async (id, d) => ({ id, ...d })),
    deleteTemplate: vi.fn().mockResolvedValue({}),
    countCampaignsForTemplate: vi.fn().mockResolvedValue(0),
    findAudienceCandidates: vi.fn().mockResolvedValue([]),
    createCampaign: vi.fn().mockImplementation(async (d) => ({ id: 'c1', ...d })),
    findCampaign: vi.fn(),
    updateCampaign: vi.fn().mockResolvedValue({}),
    failOpenRecipients: vi.fn().mockResolvedValue(0),
    statusCounts: vi.fn().mockResolvedValue({}),
    findRecipientsForExport: vi.fn().mockResolvedValue([]),
    applyStatus: vi.fn().mockResolvedValue(true),
    findRecentRecipientByPhone: vi.fn(),
    hasReplyFor: vi.fn().mockResolvedValue(0),
    createReply: vi.fn().mockResolvedValue({}),
    setOptedOut: vi.fn().mockResolvedValue(undefined),
  };
  const client = { create: vi.fn(), get: vi.fn(), remove: vi.fn() };
  const provider = { sendTemplate: vi.fn().mockResolvedValue({ messageId: 'wamid.1' }), sendText: vi.fn() };
  const audit = vi.fn().mockResolvedValue(undefined);
  const service = new BulkMessagesService(repo as never, {
    templateClient: () => client as never,
    provider: provider as never,
    audit,
    maxRecipients: 3,
  });
  return { service, repo, client, provider, audit };
}

let t: ReturnType<typeof build>;
beforeEach(() => {
  t = build();
});

describe('templates', () => {
  const dto = {
    name: 'festival_offer',
    category: 'MARKETING' as const,
    language: 'en',
    body: 'Hello {{1}}, sale starts {{2}}. Reply to know more.',
    variableExamples: ['Asha', 'Friday'],
  };

  it('saves a draft and refuses a duplicate name and language', async () => {
    await t.service.createTemplate(ADMIN, dto);
    expect(t.repo.createTemplate.mock.calls[0][0]).toMatchObject({ name: 'festival_offer', createdById: ADMIN });
    t.repo.findTemplateByNameAndLanguage.mockResolvedValue(template());
    await expect(t.service.createTemplate(ADMIN, dto)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('edits only drafts', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'APPROVED' }));
    await expect(t.service.updateTemplate('t1', dto)).rejects.toMatchObject({ statusCode: 409 });
    t.repo.findTemplate.mockResolvedValue(template());
    await t.service.updateTemplate('t1', dto);
    expect(t.repo.updateTemplate).toHaveBeenCalled();
  });

  it('submits a draft to Meta, stores its id and status, and audits without the body', async () => {
    t.repo.findTemplate.mockResolvedValue(template());
    t.client.create.mockResolvedValue({ id: '777', status: 'PENDING' });
    await t.service.submitTemplate(ADMIN, 't1');
    expect(t.client.create.mock.calls[0][0]).toMatchObject({ name: 'festival_offer', variableExamples: ['Asha', 'Friday'] });
    expect(t.repo.updateTemplate).toHaveBeenCalledWith('t1', { metaTemplateId: '777', status: 'PENDING', rejectionReason: null });
    const [, action, , , meta] = t.audit.mock.calls[0];
    expect(action).toBe('BULK_TEMPLATE_SUBMITTED');
    expect(JSON.stringify(meta)).not.toContain('Hello');
  });

  it('will not submit twice, and says so plainly when Meta access is not set up', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'PENDING' }));
    await expect(t.service.submitTemplate(ADMIN, 't1')).rejects.toMatchObject({ statusCode: 409 });

    const noClient = new BulkMessagesService(t.repo as never, { templateClient: () => null, audit: t.audit, maxRecipients: 3 });
    t.repo.findTemplate.mockResolvedValue(template());
    await expect(noClient.submitTemplate(ADMIN, 't1')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('shows Meta\'s refusal to the admin and leaves the draft a draft', async () => {
    t.repo.findTemplate.mockResolvedValue(template());
    t.client.create.mockRejectedValue(new MetaTemplateError('Meta could not submit the template: bad body', 400));
    await expect(t.service.submitTemplate(ADMIN, 't1')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('bad body') });
    expect(t.repo.updateTemplate).not.toHaveBeenCalled();
  });

  it('refresh pulls the verdict and the rejection reason', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'PENDING', metaTemplateId: '777' }));
    t.client.get.mockResolvedValue({ id: '777', status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' });
    await t.service.refreshTemplate('t1');
    expect(t.repo.updateTemplate).toHaveBeenCalledWith('t1', { status: 'REJECTED', rejectionReason: 'INVALID_FORMAT' });
  });

  it('applies the verdict Meta pushes by webhook, and ignores templates it does not know', async () => {
    t.repo.findTemplateByMetaId.mockResolvedValue(template({ metaTemplateId: '777', status: 'PENDING' }));
    await t.service.applyTemplateStatus({ metaTemplateId: '777', name: 'x', language: 'en', event: 'APPROVED' });
    expect(t.repo.updateTemplate).toHaveBeenCalledWith('t1', { status: 'APPROVED', rejectionReason: null });

    t.repo.updateTemplate.mockClear();
    t.repo.findTemplateByMetaId.mockResolvedValue(null);
    await t.service.applyTemplateStatus({ metaTemplateId: '1', name: 'x', language: 'en', event: 'APPROVED' });
    expect(t.repo.updateTemplate).not.toHaveBeenCalled();
  });

  it('cannot delete a template a campaign used', async () => {
    t.repo.findTemplate.mockResolvedValue(template());
    t.repo.countCampaignsForTemplate.mockResolvedValue(1);
    await expect(t.service.deleteTemplate('t1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('maps Meta review states', () => {
    expect(mapMetaStatus('approved')).toBe('APPROVED');
    expect(mapMetaStatus('IN_APPEAL')).toBe('PENDING');
    expect(mapMetaStatus('FLAGGED')).toBe('PAUSED');
    expect(mapMetaStatus('SOMETHING_NEW')).toBeNull();
  });
});

describe('campaigns', () => {
  const dto = {
    name: 'Diwali',
    templateId: 't1',
    audience: { mode: 'ALL_LINKED' as const },
    variableMapping: ['seller.contactName', 'fixed:Friday'],
  };

  beforeEach(() => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'APPROVED' }));
    t.repo.findAudienceCandidates.mockResolvedValue([candidate('1'), candidate('2'), candidate('3', { whatsappNumber: null })]);
  });

  it('refuses a template that is not approved', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'PENDING' }));
    await expect(t.service.createCampaign(ADMIN, dto)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('needs a value for every variable', async () => {
    await expect(t.service.createCampaign(ADMIN, { ...dto, variableMapping: ['seller.contactName'] })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('2 variables'),
    });
  });

  it('only allows CSV columns with a CSV audience that has them', async () => {
    await expect(t.service.createCampaign(ADMIN, { ...dto, variableMapping: ['csv:amount', 'fixed:x'] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      t.service.createCampaign(ADMIN, {
        ...dto,
        audience: { mode: 'CSV', csvKeyColumn: 'k', csvRows: [{ k: '1@example.com' }] },
        variableMapping: ['csv:amount', 'fixed:x'],
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('no column "amount"') });
  });

  it('freezes the eligible sellers with their variables and counts the skipped', async () => {
    await t.service.createCampaign(ADMIN, dto);
    const [data, recipients] = t.repo.createCampaign.mock.calls[0];
    expect(data).toMatchObject({ status: 'DRAFT', totalCount: 2, skippedCount: 1, createdById: ADMIN });
    expect(recipients).toEqual([
      { sellerId: '1', phone: '+919812340001', variables: ['Contact 1', 'Friday'] },
      { sellerId: '2', phone: '+919812340002', variables: ['Contact 2', 'Friday'] },
    ]);
    expect(JSON.stringify(data.audience)).not.toContain('csvRows');
  });

  it('refuses an empty audience and one over the limit', async () => {
    t.repo.findAudienceCandidates.mockResolvedValue([candidate('3', { whatsappNumber: null })]);
    await expect(t.service.createCampaign(ADMIN, dto)).rejects.toMatchObject({ message: expect.stringContaining('No eligible') });
    t.repo.findAudienceCandidates.mockResolvedValue([1, 2, 3, 4].map((n) => candidate(String(n))));
    await expect(t.service.createCampaign(ADMIN, dto)).rejects.toMatchObject({ message: expect.stringContaining('at most 3') });
  });

  it('previews who would get it, with the reasons for the rest', async () => {
    t.repo.findAudienceCandidates.mockResolvedValue([candidate('1'), candidate('2', { whatsappOptedOutAt: new Date() })]);
    const preview = await t.service.previewAudience({ mode: 'ALL_LINKED' });
    expect(preview).toMatchObject({ eligible: 1, skipped: { optedOut: 1 }, tooMany: false });
    expect(preview.sample[0]).toMatchObject({ businessName: 'Biz 1' });
  });
});

describe('start, pause, resume, cancel', () => {
  const campaign = (status: string, templateStatus = 'APPROVED') => ({
    id: 'c1',
    status,
    startedAt: null,
    totalCount: 5,
    template: template({ status: templateStatus }),
  });

  it('starts a draft and audits it', async () => {
    t.repo.findCampaign.mockResolvedValue(campaign('DRAFT'));
    await t.service.start(ADMIN, 'c1');
    expect(t.repo.updateCampaign.mock.calls[0][1]).toMatchObject({ status: 'RUNNING' });
    expect(t.repo.updateCampaign.mock.calls[0][1].startedAt).toBeInstanceOf(Date);
    expect(t.audit.mock.calls[0][1]).toBe('BULK_CAMPAIGN_STARTED');
  });

  it('will not start or resume when Meta has since paused the template', async () => {
    t.repo.findCampaign.mockResolvedValue(campaign('DRAFT', 'PAUSED'));
    await expect(t.service.start(ADMIN, 'c1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('only allows sensible transitions', async () => {
    t.repo.findCampaign.mockResolvedValue(campaign('COMPLETED'));
    await expect(t.service.pause(ADMIN, 'c1')).rejects.toMatchObject({ statusCode: 409 });
    await expect(t.service.cancel(ADMIN, 'c1')).rejects.toMatchObject({ statusCode: 409 });
    t.repo.findCampaign.mockResolvedValue(campaign('RUNNING'));
    await expect(t.service.start(ADMIN, 'c1')).rejects.toMatchObject({ statusCode: 409 });
    await t.service.pause(ADMIN, 'c1');
    t.repo.findCampaign.mockResolvedValue(campaign('PAUSED'));
    await t.service.resume(ADMIN, 'c1');
  });

  it('cancelling marks everything not yet sent as failed', async () => {
    t.repo.findCampaign.mockResolvedValue(campaign('RUNNING'));
    await t.service.cancel(ADMIN, 'c1');
    expect(t.repo.failOpenRecipients).toHaveBeenCalledWith('c1', 'Campaign cancelled');
    expect(t.repo.updateCampaign.mock.calls[0][1]).toMatchObject({ status: 'CANCELLED' });
  });

  it('404s for an unknown campaign', async () => {
    t.repo.findCampaign.mockResolvedValue(null);
    await expect(t.service.start(ADMIN, 'nope')).rejects.toBeInstanceOf(AppError);
  });
});

describe('campaign details and export', () => {
  it('adds delivery counts', async () => {
    t.repo.findCampaign.mockResolvedValue({ id: 'c1', template: template() });
    t.repo.statusCounts.mockResolvedValue({ c1: { QUEUED: 2, SENDING: 1, SENT: 3, DELIVERED: 4, READ: 5, FAILED: 1 } });
    const c = await t.service.getCampaign('c1');
    expect(c.summary).toEqual({ queued: 3, sent: 3, delivered: 4, read: 5, failed: 1, accepted: 12 });
  });

  it('exports a CSV and audits only the row count', async () => {
    t.repo.findCampaign.mockResolvedValue({ id: 'c1-aaaa-bbbb', template: template() });
    t.repo.findRecipientsForExport.mockResolvedValue([
      {
        phone: '+919812340001',
        status: 'FAILED',
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        errorCode: 131049,
        errorMessage: 'Frequency cap',
        seller: { businessName: 'Biz, "One"' },
      },
    ]);
    const { csv, filename, rows } = await t.service.exportCampaign(ADMIN, 'c1-aaaa-bbbb');
    expect(rows).toBe(1);
    expect(csv).toContain('"Biz, ""One"""');
    expect(csv).toContain('131049');
    expect(filename).toMatch(/^bulk-campaign-c1-aaaa-/);
    expect(t.audit.mock.calls[0][4]).toEqual({ rows: 1 });
  });
});

describe('testSend', () => {
  const dto = { templateId: 't1', phone: '98123 40001', variables: ['Asha', 'Friday'] };

  it('sends the approved template to one number', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'APPROVED' }));
    const res = await t.service.testSend({ ...dto, phone: '+919812340001' });
    expect(res).toEqual({ messageId: 'wamid.1' });
    expect(t.provider.sendTemplate).toHaveBeenCalledWith('+919812340001', { name: 'festival_offer', language: 'en', body: ['Asha', 'Friday'] });
  });

  it('checks approval, number and variable count first', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'DRAFT' }));
    await expect(t.service.testSend({ ...dto, phone: '+919812340001' })).rejects.toMatchObject({ statusCode: 400 });
    t.repo.findTemplate.mockResolvedValue(template({ status: 'APPROVED' }));
    await expect(t.service.testSend({ ...dto, phone: 'abc' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(t.service.testSend({ ...dto, phone: '+919812340001', variables: ['one'] })).rejects.toMatchObject({ statusCode: 400 });
    expect(t.provider.sendTemplate).not.toHaveBeenCalled();
  });

  it('turns a refused send into a readable error', async () => {
    t.repo.findTemplate.mockResolvedValue(template({ status: 'APPROVED' }));
    t.provider.sendTemplate.mockRejectedValue(new WhatsAppSendError('Meta WhatsApp template send failed with 400 (code 131030: not allowed)', 400, 131030));
    await expect(t.service.testSend({ ...dto, phone: '+919812340001' })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('131030'),
    });
  });
});

describe('hooks used by the WhatsApp module', () => {
  it('passes delivery receipts through', async () => {
    await t.service.recordStatuses([
      { providerMessageId: 'w1', status: 'delivered' },
      { providerMessageId: 'w2', status: 'failed', errorCode: 131049, errorMessage: 'cap' },
    ]);
    expect(t.repo.applyStatus).toHaveBeenNthCalledWith(1, 'w1', 'delivered', { code: undefined, message: undefined });
    expect(t.repo.applyStatus).toHaveBeenNthCalledWith(2, 'w2', 'failed', { code: 131049, message: 'cap' });
  });

  const message = { providerMessageId: 'm1', from: '+919812340001', body: 'Thanks!', media: [] };

  it('saves a reply to a recent broadcast and says whether it is the first', async () => {
    t.repo.findRecentRecipientByPhone.mockResolvedValue({ id: 'r1', campaignId: 'c1', sellerId: 's1' });
    expect(await t.service.recordReply(message)).toEqual({ firstReply: true });
    expect(t.repo.createReply).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'r1', campaignId: 'c1', sellerId: 's1', text: 'Thanks!', type: 'text' }));

    t.repo.hasReplyFor.mockResolvedValue(1);
    expect(await t.service.recordReply({ ...message, providerMessageId: 'm2' })).toEqual({ firstReply: false });
  });

  it('ignores numbers that were not sent a broadcast in the last 24 hours', async () => {
    t.repo.findRecentRecipientByPhone.mockResolvedValue(null);
    expect(await t.service.recordReply(message)).toBeNull();
    expect(t.repo.createReply).not.toHaveBeenCalled();
    const since = t.repo.findRecentRecipientByPhone.mock.calls[0][1] as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThan(23.9 * 3600_000);
    expect(Date.now() - since.getTime()).toBeLessThan(24.1 * 3600_000);
  });

  it('caps a stored reply at 1000 characters', async () => {
    t.repo.findRecentRecipientByPhone.mockResolvedValue({ id: 'r1', campaignId: 'c1', sellerId: 's1' });
    await t.service.recordReply({ ...message, body: 'x'.repeat(5000) });
    expect(t.repo.createReply.mock.calls[0][0].text).toHaveLength(1000);
  });
});
