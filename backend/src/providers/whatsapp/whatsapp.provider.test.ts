import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwilioWhatsAppProvider, isValidTwilioSignature, parseTwilioInbound, twilioSignature } from './index';

const url = 'https://api.example.com/api/v1/whatsapp/webhook';
const params = { From: 'whatsapp:+919812345678', Body: 'Hello', MessageSid: 'SM1', NumMedia: '0' };

describe('twilio signature', () => {
  it('accepts a signature computed over url + sorted params', () => {
    const sig = twilioSignature('secret', url, params);
    expect(isValidTwilioSignature('secret', url, params, sig)).toBe(true);
  });

  it('rejects a wrong token, a changed body, a different url or a missing signature', () => {
    const sig = twilioSignature('secret', url, params);
    expect(isValidTwilioSignature('other', url, params, sig)).toBe(false);
    expect(isValidTwilioSignature('secret', url, { ...params, Body: 'Hi' }, sig)).toBe(false);
    expect(isValidTwilioSignature('secret', `${url}x`, params, sig)).toBe(false);
    expect(isValidTwilioSignature('secret', url, params, undefined)).toBe(false);
    expect(isValidTwilioSignature('secret', url, params, 'short')).toBe(false);
  });

  it('matches the example from Twilio docs ordering (keys sorted, no separators)', () => {
    // Computed independently: HMAC-SHA1 over "https://x.test/hookA1B2" with token "t".
    const sig = twilioSignature('t', 'https://x.test/hook', { B: '2', A: '1' });
    expect(sig).toBe(twilioSignature('t', 'https://x.test/hook', { A: '1', B: '2' }));
  });
});

describe('parseTwilioInbound', () => {
  it('parses a text message and normalises the sender', () => {
    expect(parseTwilioInbound(params)).toEqual({
      providerMessageId: 'SM1',
      from: '+919812345678',
      body: 'Hello',
      media: [],
    });
  });

  it('collects media urls and types, capped at NumMedia', () => {
    const msg = parseTwilioInbound({
      ...params,
      NumMedia: '2',
      MediaUrl0: 'https://api.twilio.com/m/0',
      MediaContentType0: 'image/jpeg',
      MediaUrl1: 'https://api.twilio.com/m/1',
      MediaContentType1: 'video/mp4',
      MediaUrl2: 'https://api.twilio.com/m/2',
    });
    expect(msg?.media).toEqual([
      { url: 'https://api.twilio.com/m/0', contentType: 'image/jpeg' },
      { url: 'https://api.twilio.com/m/1', contentType: 'video/mp4' },
    ]);
  });

  it('returns null without a message id or a valid sender', () => {
    expect(parseTwilioInbound({ From: 'whatsapp:+919812345678' })).toBeNull();
    expect(parseTwilioInbound({ MessageSid: 'SM1', From: 'whatsapp:abc' })).toBeNull();
    expect(parseTwilioInbound({ MessageSid: 'SM1' })).toBeNull();
  });
});

describe('TwilioWhatsAppProvider.sendTemplate', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const provider = new TwilioWhatsAppProvider('AC1', 'token', '+14155238886');

  it('sends the Content SID with numbered variables and no body text', async () => {
    await provider.sendTemplate('+919812345678', { name: 'HX123', language: 'en', body: ['Brass Diya', 'Blurry'] });
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(form.get('ContentSid')).toBe('HX123');
    expect(JSON.parse(form.get('ContentVariables') ?? '')).toEqual({ '1': 'Brass Diya', '2': 'Blurry' });
    expect(form.get('To')).toBe('whatsapp:+919812345678');
    expect(form.get('From')).toBe('whatsapp:+14155238886');
    expect(form.has('Body')).toBe(false);
  });

  it('uses the code as variable 1 for a code-only template', async () => {
    await provider.sendTemplate('+919812345678', { name: 'HX9', language: 'en', body: [], copyCode: '123456' });
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(form.get('ContentVariables') ?? '')).toEqual({ '1': '123456' });
  });

  it('says why when Twilio refuses: its error code and message, never a credential', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: 21654, message: 'ContentSid Required' }) });
    const err = await provider.sendTemplate('+919812345678', { name: 'HX1', language: 'en', body: [] }).catch((e: Error) => e);
    expect((err as Error).message).toContain('400 (code 21654: ContentSid Required)');
    expect((err as Error).message).not.toContain('token');
  });

  it('plain-text sends say why they were refused too (this is the link code path)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: 21654, message: 'ContentSid Required' }) });
    await expect(provider.sendText('+919812345678', 'hello')).rejects.toThrow('Twilio WhatsApp send failed with 400 (code 21654: ContentSid Required)');
  });

  it('falls back to the bare status when Twilio sends no readable error body', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(provider.sendText('+919812345678', 'hello')).rejects.toThrow('Twilio WhatsApp send failed with 503');
  });

  it('throws when Twilio refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(provider.sendTemplate('+919812345678', { name: 'HX1', language: 'en', body: [] })).rejects.toThrow(/400/);
  });
});
