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

/** The real service and a real Meta provider; only storage and the conversation are faked. */
vi.mock('./whatsapp.wiring', async () => {
  const providers = await vi.importActual<typeof import('../../providers/whatsapp')>('../../providers/whatsapp');
  const { WhatsAppService } = await vi.importActual<typeof import('./whatsapp.service')>('./whatsapp.service');
  const provider = new providers.MetaWhatsAppProvider({
    accessToken: 'tok',
    phoneNumberId: 'PN1',
    appSecret: 'app-secret',
    verifyToken: 'verify-me',
    graphVersion: 'v23.0',
  });
  const handled = vi.fn().mockResolvedValue(undefined);
  const repo = { recordIfNew: vi.fn().mockResolvedValue(true) };
  return {
    whatsAppService: new WhatsAppService(repo as never, provider, { handle: handled }),
    __handled: handled,
  };
});

import { createApp } from '../../app';
import { metaSignature } from '../../providers/whatsapp';
import * as wiring from './whatsapp.wiring';

const handled = (wiring as unknown as { __handled: ReturnType<typeof vi.fn> }).__handled;
const app = createApp();
const URL = '/api/v1/whatsapp/webhook';

const body = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: 'PN1' },
            messages: [{ from: '919812345678', id: 'wamid.1', type: 'text', text: { body: 'stock 1 5' } }],
          },
        },
      ],
    },
  ],
});

const post = (raw: string, signature?: string) => {
  const req = request(app).post(URL).set('Content-Type', 'application/json');
  if (signature) req.set('X-Hub-Signature-256', signature);
  return req.send(raw);
};

describe('POST /whatsapp/webhook with Meta JSON', () => {
  beforeEach(() => handled.mockClear());

  it('accepts a correctly signed body and processes the message afterwards', async () => {
    const res = await post(body, metaSignature('app-secret', Buffer.from(body)));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(handled).toHaveBeenCalledTimes(1));
    expect(handled.mock.calls[0][0]).toMatchObject({ providerMessageId: 'wamid.1', from: '+919812345678', body: 'stock 1 5' });
  });

  it('rejects a body signed with the wrong secret', async () => {
    const res = await post(body, metaSignature('other-secret', Buffer.from(body)));
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 20));
    expect(handled).not.toHaveBeenCalled();
  });

  it('rejects a body that changed after signing, even by one space', async () => {
    const signature = metaSignature('app-secret', Buffer.from(body));
    const res = await post(`${body} `, signature);
    expect(res.status).toBe(403);
    expect(handled).not.toHaveBeenCalled();
  });

  it('rejects a call with no signature', async () => {
    expect((await post(body)).status).toBe(403);
    expect(handled).not.toHaveBeenCalled();
  });
});

describe('GET /whatsapp/webhook (Meta verification)', () => {
  it('echoes the challenge for the right token', async () => {
    const res = await request(app).get(URL).query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '424242' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('424242');
  });

  it('refuses a wrong token or mode', async () => {
    const wrong = await request(app).get(URL).query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' });
    expect(wrong.status).toBe(403);
    const mode = await request(app).get(URL).query({ 'hub.mode': 'other', 'hub.verify_token': 'verify-me', 'hub.challenge': '1' });
    expect(mode.status).toBe(403);
  });
});
