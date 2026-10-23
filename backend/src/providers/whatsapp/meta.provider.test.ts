import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConsoleWhatsAppProvider,
  MetaWhatsAppProvider,
  ProviderSettings,
  TwilioWhatsAppProvider,
  WebhookRequest,
  createWhatsAppProvider,
  isValidMetaSignature,
  metaSignature,
  parseMetaInbound,
} from './index';

const config = {
  accessToken: 'token-123',
  phoneNumberId: 'PN1',
  appSecret: 'secret',
  verifyToken: 'verify-me',
  graphVersion: 'v23.0',
};

function payload(messages: unknown[], phoneNumberId = 'PN1') {
  return { object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, messages } }] }] };
}

function request(body: unknown, signatureOf?: string): WebhookRequest {
  const rawBody = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return {
    url: 'https://api.example.com/api/v1/whatsapp/webhook',
    header: (name) => (name.toLowerCase() === 'x-hub-signature-256' ? (signatureOf ?? metaSignature(config.appSecret, rawBody)) : undefined),
    rawBody,
    form: {},
    query: {},
  };
}

describe('meta signature', () => {
  const raw = Buffer.from('{"a":1}');

  it('accepts the HMAC-SHA256 of the exact bytes', () => {
    expect(isValidMetaSignature('secret', raw, metaSignature('secret', raw))).toBe(true);
    expect(metaSignature('secret', raw)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('rejects a wrong secret, changed bytes, a missing header or a missing body', () => {
    const sig = metaSignature('secret', raw);
    expect(isValidMetaSignature('other', raw, sig)).toBe(false);
    expect(isValidMetaSignature('secret', Buffer.from('{"a":2}'), sig)).toBe(false);
    expect(isValidMetaSignature('secret', raw, undefined)).toBe(false);
    expect(isValidMetaSignature('secret', undefined, sig)).toBe(false);
    expect(isValidMetaSignature('secret', raw, 'sha256=short')).toBe(false);
  });
});

describe('parseMetaInbound', () => {
  it('reads a text message and normalises the sender', () => {
    const [msg] = parseMetaInbound(payload([{ from: '919812345678', id: 'wamid.1', type: 'text', text: { body: ' hello ' } }]));
    expect(msg).toEqual({ providerMessageId: 'wamid.1', from: '+919812345678', body: 'hello', media: [] });
  });

  it('reads a photo with its caption as a media reference', () => {
    const [msg] = parseMetaInbound(
      payload([{ from: '919812345678', id: 'wamid.2', type: 'image', image: { id: 'MEDIA1', mime_type: 'image/jpeg', caption: 'brass diya' } }]),
    );
    expect(msg.body).toBe('brass diya');
    expect(msg.media).toEqual([{ url: 'meta-media:MEDIA1', contentType: 'image/jpeg' }]);
  });

  it('strips codec parameters from voice note types', () => {
    const [msg] = parseMetaInbound(
      payload([{ from: '919812345678', id: 'wamid.3', type: 'audio', audio: { id: 'A1', mime_type: 'audio/ogg; codecs=opus' } }]),
    );
    expect(msg.media[0].contentType).toBe('audio/ogg');
  });

  it('reads tapped buttons and list choices as text', () => {
    const msgs = parseMetaInbound(
      payload([
        { from: '919812345678', id: 'w4', type: 'interactive', interactive: { button_reply: { title: 'Yes' } } },
        { from: '919812345678', id: 'w5', type: 'interactive', interactive: { list_reply: { title: 'Cotton' } } },
        { from: '919812345678', id: 'w6', type: 'button', button: { text: 'Confirm' } },
      ]),
    );
    expect(msgs.map((m) => m.body)).toEqual(['Yes', 'Cotton', 'Confirm']);
  });

  it('returns every message in a batch, in order', () => {
    const msgs = parseMetaInbound(
      payload([
        { from: '919812345678', id: 'a', type: 'text', text: { body: '1' } },
        { from: '919812345678', id: 'b', type: 'text', text: { body: '2' } },
      ]),
    );
    expect(msgs.map((m) => m.providerMessageId)).toEqual(['a', 'b']);
  });

  it('gives nothing for delivery receipts', () => {
    const receipt = { entry: [{ changes: [{ value: { metadata: { phone_number_id: 'PN1' }, statuses: [{ id: 'x', status: 'delivered' }] } }] }] };
    expect(parseMetaInbound(receipt)).toEqual([]);
  });

  it('keeps only messages sent to our own number', () => {
    const body = payload([{ from: '919812345678', id: 'a', type: 'text', text: { body: 'hi' } }], 'OTHER');
    expect(parseMetaInbound(body, 'PN1')).toEqual([]);
    expect(parseMetaInbound(body)).toHaveLength(1);
  });

  it('lets unsupported kinds through with an empty body, and skips unusable entries', () => {
    const msgs = parseMetaInbound(
      payload([
        { from: '919812345678', id: 'loc', type: 'location', location: { latitude: 1 } },
        { from: '919812345678', type: 'text', text: { body: 'no id' } },
        { id: 'no-from', type: 'text', text: { body: 'x' } },
        { from: 'abc', id: 'bad-from', type: 'text', text: { body: 'x' } },
        'garbage',
      ]),
    );
    expect(msgs).toEqual([{ providerMessageId: 'loc', from: '+919812345678', body: '', media: [] }]);
  });

  it('survives malformed payloads', () => {
    for (const bad of [null, 'x', 42, [], {}, { entry: 'no' }, { entry: [null, { changes: 'no' }, { changes: [{ value: null }] }] }]) {
      expect(parseMetaInbound(bad)).toEqual([]);
    }
  });
});

describe('MetaWhatsAppProvider webhook checks', () => {
  const provider = new MetaWhatsAppProvider(config);

  it('verifies the signature over the raw bytes', () => {
    expect(provider.verifyWebhook(request(payload([])))).toBe(true);
    expect(provider.verifyWebhook(request(payload([]), 'sha256=00'))).toBe(false);
  });

  it('parses the raw JSON body and ignores invalid JSON', () => {
    const msgs = provider.parseInbound(request(payload([{ from: '919812345678', id: 'a', type: 'text', text: { body: 'hi' } }])));
    expect(msgs).toHaveLength(1);
    expect(provider.parseInbound(request('not json'))).toEqual([]);
    expect(provider.parseInbound({ ...request({}), rawBody: undefined })).toEqual([]);
  });

  it('echoes the challenge only for the right mode and token', () => {
    expect(provider.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '777' })).toBe('777');
    expect(provider.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '777' })).toBeNull();
    expect(provider.verifyChallenge({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '777' })).toBeNull();
    expect(provider.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.challenge': '777' })).toBeNull();
  });
});

describe('MetaWhatsAppProvider network calls', () => {
  const provider = new MetaWhatsAppProvider(config);
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (data: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => data, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response;

  it('sends text through the Graph API with the bearer token and no plus sign', async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: 'x' }] }));
    await provider.sendText('+919812345678', 'hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/PN1/messages');
    expect(init.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(init.body)).toMatchObject({ messaging_product: 'whatsapp', to: '919812345678', type: 'text', text: { body: 'hello' } });
  });

  it('caps very long replies', async () => {
    fetchMock.mockResolvedValue(json({}));
    await provider.sendText('+919812345678', 'x'.repeat(5000));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.body).toHaveLength(4096);
  });

  it('reports Meta\'s error code and message, never the token', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 131047, message: 'Re-engagement message' } }, false, 400));
    const err = await provider.sendText('+919812345678', 'hi').catch((e: Error) => e);
    expect((err as Error).message).toContain('131047');
    expect((err as Error).message).toContain('Re-engagement message');
    expect((err as Error).message).not.toContain('token-123');
  });

  describe('sendTemplate', () => {
    it('sends body values as template parameters', async () => {
      fetchMock.mockResolvedValue(json({}));
      await provider.sendTemplate('+919812345678', { name: 'product_rejected', language: 'en', body: ['Brass Diya', 'Photos are blurry'] });
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/PN1/messages');
      expect(sent).toMatchObject({ messaging_product: 'whatsapp', to: '919812345678', type: 'template' });
      expect(sent.template).toEqual({
        name: 'product_rejected',
        language: { code: 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Brass Diya' }, { type: 'text', text: 'Photos are blurry' }] }],
      });
    });

    it('repeats the code as the copy-code button parameter for an authentication template', async () => {
      fetchMock.mockResolvedValue(json({}));
      await provider.sendTemplate('+919812345678', { name: 'auth_code', language: 'en', body: ['123456'], copyCode: '123456' });
      const { components } = JSON.parse(fetchMock.mock.calls[0][1].body).template;
      expect(components).toEqual([
        { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '123456' }] },
      ]);
    });

    it('reports the reason Meta gives when the template is rejected', async () => {
      fetchMock.mockResolvedValue(json({ error: { code: 132001, message: 'Template does not exist' } }, false, 404));
      await expect(provider.sendTemplate('+919812345678', { name: 'x', language: 'en', body: [] })).rejects.toThrow(/132001/);
    });
  });

  describe('downloadMedia', () => {
    const bytes = (n: number) => ({ ok: true, status: 200, headers: new Headers({ 'content-length': String(n) }), arrayBuffer: async () => new ArrayBuffer(n) }) as unknown as Response;

    it('looks the media up, then downloads it with the token', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/file', mime_type: 'image/jpeg', file_size: 100 }))
        .mockResolvedValueOnce(bytes(100));
      const file = await provider.downloadMedia('meta-media:MEDIA1', 1000);
      expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/MEDIA1');
      expect(fetchMock.mock.calls[1][0]).toBe('https://lookaside.fbsbx.com/file');
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-123');
      expect(file.contentType).toBe('image/jpeg');
      expect(file.buffer).toHaveLength(100);
    });

    it('refuses an oversized file before downloading it', async () => {
      fetchMock.mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/file', mime_type: 'video/mp4', file_size: 5000 }));
      await expect(provider.downloadMedia('meta-media:M', 1000)).rejects.toThrow(/too large/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses an actual download bigger than declared', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/file', mime_type: 'image/png' }))
        .mockResolvedValueOnce(bytes(2000));
      await expect(provider.downloadMedia('meta-media:M', 1000)).rejects.toThrow(/too large/);
    });

    it('refuses references that are not ours and non-https URLs', async () => {
      await expect(provider.downloadMedia('https://evil.example/x', 1000)).rejects.toThrow(/Not a Meta media reference/);
      await expect(provider.downloadMedia('meta-media:../../etc', 1000)).rejects.toThrow(/Invalid Meta media id/);
      fetchMock.mockResolvedValueOnce(json({ url: 'http://insecure.example/file', mime_type: 'image/png' }));
      await expect(provider.downloadMedia('meta-media:M', 1000)).rejects.toThrow(/usable media URL/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createWhatsAppProvider', () => {
  const none: ProviderSettings = {
    WHATSAPP_PROVIDER: 'auto',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_WHATSAPP_FROM: '',
    META_WHATSAPP_ACCESS_TOKEN: '',
    META_WHATSAPP_PHONE_NUMBER_ID: '',
    META_WHATSAPP_APP_SECRET: '',
    META_WHATSAPP_VERIFY_TOKEN: '',
    META_GRAPH_VERSION: 'v23.0',
  };
  const twilio = { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_WHATSAPP_FROM: '+14155238886' };
  const meta = {
    META_WHATSAPP_ACCESS_TOKEN: 'a',
    META_WHATSAPP_PHONE_NUMBER_ID: 'p',
    META_WHATSAPP_APP_SECRET: 's',
    META_WHATSAPP_VERIFY_TOKEN: 'v',
  };

  it('logs only when nothing is configured', () => {
    const { name, provider } = createWhatsAppProvider(none);
    expect(name).toBe('console');
    expect(provider).toBeInstanceOf(ConsoleWhatsAppProvider);
  });

  it('auto prefers Meta, then Twilio', () => {
    expect(createWhatsAppProvider({ ...none, ...twilio, ...meta }).name).toBe('meta');
    expect(createWhatsAppProvider({ ...none, ...twilio }).name).toBe('twilio');
    expect(createWhatsAppProvider({ ...none, ...twilio }).provider).toBeInstanceOf(TwilioWhatsAppProvider);
  });

  it('auto ignores incomplete Meta settings', () => {
    expect(createWhatsAppProvider({ ...none, ...twilio, ...meta, META_WHATSAPP_APP_SECRET: '' }).name).toBe('twilio');
  });

  it('an explicit choice is honoured even when the other is configured', () => {
    expect(createWhatsAppProvider({ ...none, ...twilio, ...meta, WHATSAPP_PROVIDER: 'twilio' }).name).toBe('twilio');
    expect(createWhatsAppProvider({ ...none, ...twilio, ...meta, WHATSAPP_PROVIDER: 'meta' }).name).toBe('meta');
  });

  it('an explicit choice with incomplete settings logs only instead of using the other provider', () => {
    expect(createWhatsAppProvider({ ...none, ...twilio, WHATSAPP_PROVIDER: 'meta' }).name).toBe('console');
    expect(createWhatsAppProvider({ ...none, ...meta, WHATSAPP_PROVIDER: 'twilio' }).name).toBe('console');
  });
});
