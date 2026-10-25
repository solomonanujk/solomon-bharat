import { describe, expect, it, vi } from 'vitest';
import { InboundMessage, WebhookRequest, WhatsAppProvider } from '../../providers/whatsapp';
import { BulkHooks, WhatsAppService } from './whatsapp.service';
import { WhatsAppRepository } from './whatsapp.repository';

const req: WebhookRequest = { url: 'https://api/hook', header: () => undefined, form: {}, query: {} };

function build(over: Partial<WhatsAppProvider> = {}, bulkOver: Partial<BulkHooks> = {}) {
  const repo = { recordIfNew: vi.fn().mockResolvedValue(true) } as unknown as WhatsAppRepository;
  const provider: WhatsAppProvider = {
    sendText: vi.fn(),
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseInbound: vi.fn().mockReturnValue([]),
    downloadMedia: vi.fn(),
    ...over,
  };
  const bulk = {
    recordStatuses: vi.fn().mockResolvedValue(undefined),
    applyTemplateStatus: vi.fn().mockResolvedValue(undefined),
    ...bulkOver,
  } satisfies BulkHooks;
  const conversation = { handle: vi.fn().mockResolvedValue(undefined) };
  return { service: new WhatsAppService(repo, provider, conversation, bulk), bulk, conversation };
}

describe('WhatsAppService delivery receipts and template verdicts', () => {
  it('hands receipts and template events to Bulk Messages', async () => {
    const statuses = [{ providerMessageId: 'w1', status: 'delivered' as const }];
    const events = [{ metaTemplateId: '7', name: 'offer', language: 'en', event: 'APPROVED' }];
    const t = build({ parseStatuses: () => statuses, parseTemplateStatuses: () => events });
    await t.service.handleInbound(req);
    expect(t.bulk.recordStatuses).toHaveBeenCalledWith(statuses);
    expect(t.bulk.applyTemplateStatus).toHaveBeenCalledWith(events[0]);
  });

  it('still handles the messages in the same delivery', async () => {
    const message: InboundMessage = { providerMessageId: 'm1', from: '+919812340001', body: 'hi', media: [] };
    const t = build({
      parseInbound: () => [message],
      parseStatuses: () => [{ providerMessageId: 'w1', status: 'read' as const }],
    });
    await t.service.handleInbound(req);
    expect(t.bulk.recordStatuses).toHaveBeenCalled();
    expect(t.conversation.handle).toHaveBeenCalledWith(message);
  });

  it('a failure while recording receipts never blocks the messages', async () => {
    const message: InboundMessage = { providerMessageId: 'm1', from: '+919812340001', body: 'hi', media: [] };
    const t = build(
      { parseInbound: () => [message], parseStatuses: () => [{ providerMessageId: 'w1', status: 'read' as const }] },
      { recordStatuses: vi.fn().mockRejectedValue(new Error('db down')) },
    );
    await expect(t.service.handleInbound(req)).resolves.toBeUndefined();
    expect(t.conversation.handle).toHaveBeenCalledWith(message);
  });

  it('works for providers with no receipts (Twilio) and without Bulk Messages wired', async () => {
    const t = build();
    await t.service.handleInbound(req);
    expect(t.bulk.recordStatuses).not.toHaveBeenCalled();

    const repo = { recordIfNew: vi.fn().mockResolvedValue(true) } as unknown as WhatsAppRepository;
    const plain = new WhatsAppService(repo, { sendText: vi.fn(), verifyWebhook: vi.fn(), parseInbound: () => [], downloadMedia: vi.fn() });
    await expect(plain.handleInbound(req)).resolves.toBeUndefined();
  });
});
