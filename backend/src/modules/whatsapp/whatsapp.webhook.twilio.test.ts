import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatchAllMockPrisma } from '../../test-utils/mockPrisma';

vi.mock('../../middleware/rateLimiter', () => ({
  publicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../config/prisma', () => ({ prisma: buildCatchAllMockPrisma() }));
vi.mock('../../config/redis', () => ({
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn() },
}));
vi.mock('../../config/env', async () => {
  const actual = await vi.importActual<typeof import('../../config/env')>('../../config/env');
  return { ...actual, env: { ...actual.env, WHATSAPP_WEBHOOK_BASE_URL: 'https://api.example.com' } };
});

/** The real service and a real Twilio provider; only storage and the conversation are faked. */
vi.mock('./whatsapp.wiring', async () => {
  const providers = await vi.importActual<typeof import('../../providers/whatsapp')>('../../providers/whatsapp');
  const { WhatsAppService } = await vi.importActual<typeof import('./whatsapp.service')>('./whatsapp.service');
  const provider = new providers.TwilioWhatsAppProvider('AC1', 'twilio-token', '+14155238886');
  const handled = vi.fn().mockResolvedValue(undefined);
  const repo = { recordIfNew: vi.fn().mockResolvedValue(true) };
  return {
    whatsAppService: new WhatsAppService(repo as never, provider, { handle: handled }),
    __handled: handled,
  };
});

import { createApp } from '../../app';
import { twilioSignature } from '../../providers/whatsapp';
import * as wiring from './whatsapp.wiring';

const handled = (wiring as unknown as { __handled: ReturnType<typeof vi.fn> }).__handled;
const app = createApp();
const PATH = '/api/v1/whatsapp/webhook';
const PUBLIC_URL = `https://api.example.com${PATH}`;
const form = { From: 'whatsapp:+919812345678', Body: 'list', MessageSid: 'SM1', NumMedia: '0' };

describe('POST /whatsapp/webhook with a Twilio form (Meta raw-body handling must not get in the way)', () => {
  beforeEach(() => handled.mockClear());

  it('accepts a correctly signed form post and processes the message afterwards', async () => {
    const res = await request(app)
      .post(PATH)
      .set('X-Twilio-Signature', twilioSignature('twilio-token', PUBLIC_URL, form))
      .type('form')
      .send(form);
    expect(res.status).toBe(200);
    expect(res.text).toBe('<Response/>');
    await vi.waitFor(() => expect(handled).toHaveBeenCalledTimes(1));
    expect(handled.mock.calls[0][0]).toMatchObject({ providerMessageId: 'SM1', from: '+919812345678', body: 'list' });
  });

  it('rejects a wrong or missing signature', async () => {
    const wrong = await request(app).post(PATH).set('X-Twilio-Signature', 'AAAA').type('form').send(form);
    expect(wrong.status).toBe(403);
    const missing = await request(app).post(PATH).type('form').send(form);
    expect(missing.status).toBe(403);
    expect(handled).not.toHaveBeenCalled();
  });

  it('refuses the Meta verification GET because Twilio has no such handshake', async () => {
    const res = await request(app).get(PATH).query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '1' });
    expect(res.status).toBe(403);
  });
});
