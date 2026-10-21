import { describe, expect, it, vi } from 'vitest';
import { InboundMessage, WebhookRequest, WhatsAppProvider, parseTwilioInbound } from '../../providers/whatsapp';
import { ConversationHandler } from './whatsapp.conversation';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppService, classifyMessage } from './whatsapp.service';

function build(isNew = true) {
  const repo = { recordIfNew: vi.fn().mockResolvedValue(isNew) } as unknown as WhatsAppRepository;
  const provider: WhatsAppProvider = {
    sendText: vi.fn(),
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseInbound: (req) => {
      const message = parseTwilioInbound(req.form);
      return message ? [message] : [];
    },
    downloadMedia: vi.fn().mockResolvedValue({ buffer: Buffer.from('x'), contentType: 'image/jpeg' }),
  };
  const conversation = { handle: vi.fn().mockResolvedValue(undefined) } satisfies ConversationHandler;
  return { service: new WhatsAppService(repo, provider, conversation), repo, provider, conversation };
}

/** A webhook call carrying Twilio-style form fields. */
function request(form: Record<string, string>): WebhookRequest {
  return { url: 'https://api.example.com/api/v1/whatsapp/webhook', header: () => undefined, form, query: {} };
}

const params = { From: 'whatsapp:+919812345678', Body: 'saree', MessageSid: 'SM1', NumMedia: '0' };

describe('WhatsAppService.handleInbound', () => {
  it('records a new message and hands it to the conversation', async () => {
    const { service, repo, conversation } = build(true);
    await service.handleInbound(request(params));
    expect(repo.recordIfNew).toHaveBeenCalledWith({
      providerMessageId: 'SM1',
      phone: '+919812345678',
      type: 'text',
      mediaCount: 0,
    });
    expect(conversation.handle).toHaveBeenCalledTimes(1);
  });

  it('drops a duplicate delivery before the conversation sees it', async () => {
    const { service, conversation } = build(false);
    await expect(service.handleInbound(request(params))).resolves.toBeUndefined();
    expect(conversation.handle).not.toHaveBeenCalled();
  });

  it('ignores a webhook with no usable sender without touching the database', async () => {
    const { service, repo } = build();
    await service.handleInbound(request({ MessageSid: 'SM2' }));
    expect(repo.recordIfNew).not.toHaveBeenCalled();
  });

  it('handles every message in a batched delivery, in order', async () => {
    const { service, provider, conversation } = build();
    const batch: InboundMessage[] = ['a', 'b', 'c'].map((id) => ({
      providerMessageId: id,
      from: '+919812345678',
      body: id,
      media: [],
    }));
    provider.parseInbound = () => batch;
    await service.handleInbound(request({}));
    expect(conversation.handle.mock.calls.map((c) => c[0].providerMessageId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps going when one message in a batch fails', async () => {
    const { service, provider, conversation } = build();
    provider.parseInbound = () => [
      { providerMessageId: 'a', from: '+919812345678', body: 'a', media: [] },
      { providerMessageId: 'b', from: '+919812345678', body: 'b', media: [] },
    ];
    conversation.handle.mockRejectedValueOnce(new Error('boom'));
    await expect(service.handleInbound(request({}))).resolves.toBeUndefined();
    expect(conversation.handle).toHaveBeenCalledTimes(2);
  });
});

describe('WhatsAppService provider hooks', () => {
  it('delegates signature checks to the provider', () => {
    const { service, provider } = build();
    const req = request(params);
    expect(service.verifyRequest(req)).toBe(true);
    expect(provider.verifyWebhook).toHaveBeenCalledWith(req);
  });

  it('answers the webhook challenge only when the provider supports and accepts it', () => {
    const { service, provider } = build();
    expect(service.verifyChallenge({ 'hub.mode': 'subscribe' })).toBeNull();
    provider.verifyChallenge = vi.fn().mockReturnValue('12345');
    expect(service.verifyChallenge({ 'hub.mode': 'subscribe' })).toBe('12345');
  });
});

describe('WhatsAppService.fetchMedia', () => {
  it('downloads allowed images and videos with the right size cap', async () => {
    const { service, provider } = build();
    const image = await service.fetchMedia({ url: 'https://api.twilio.com/a', contentType: 'image/jpeg' });
    expect(image.kind).toBe('image');
    expect(provider.downloadMedia).toHaveBeenCalledWith('https://api.twilio.com/a', 5 * 1024 * 1024);

    const video = await service.fetchMedia({ url: 'https://api.twilio.com/b', contentType: 'video/mp4' });
    expect(video.kind).toBe('video');
    expect(provider.downloadMedia).toHaveBeenLastCalledWith('https://api.twilio.com/b', 16 * 1024 * 1024);
  });

  it('rejects unsupported types before downloading anything', async () => {
    const { service, provider } = build();
    await expect(service.fetchMedia({ url: 'https://api.twilio.com/c', contentType: 'image/heic' })).rejects.toThrow(
      /Unsupported media type/,
    );
    expect(provider.downloadMedia).not.toHaveBeenCalled();
  });
});

describe('classifyMessage', () => {
  it('classifies by the first media type', () => {
    const base = { providerMessageId: 'a', from: '+911234567890', body: '' };
    expect(classifyMessage({ ...base, media: [] })).toBe('text');
    expect(classifyMessage({ ...base, media: [{ url: 'u', contentType: 'image/png' }] })).toBe('image');
    expect(classifyMessage({ ...base, media: [{ url: 'u', contentType: 'video/mp4' }] })).toBe('video');
    expect(classifyMessage({ ...base, media: [{ url: 'u', contentType: 'audio/ogg' }] })).toBe('audio');
    expect(classifyMessage({ ...base, media: [{ url: 'u', contentType: 'application/pdf' }] })).toBe('other');
  });
});
