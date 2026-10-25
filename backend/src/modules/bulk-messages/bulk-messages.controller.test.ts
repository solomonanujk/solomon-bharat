import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import { buildCatchAllMockPrisma } from '../../test-utils/mockPrisma';
import { authHeader } from '../../test-utils/authToken';

vi.mock('../../middleware/rateLimiter', () => ({
  publicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../config/prisma', () => ({ prisma: buildCatchAllMockPrisma() }));
vi.mock('../../config/redis', () => ({
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn(), pexpire: vi.fn() },
}));
vi.mock('./bulk-messages.service', async () => {
  const actual = await vi.importActual<typeof import('./bulk-messages.service')>('./bulk-messages.service');
  const fns = [
    'listTemplates', 'syncTemplates', 'getTemplate', 'createTemplate', 'updateTemplate', 'submitTemplate', 'refreshTemplate', 'deleteTemplate',
    'previewAudience', 'listCampaigns', 'getCampaign', 'createCampaign', 'listRecipients', 'start', 'pause', 'resume', 'cancel',
    'exportCampaign', 'testSend', 'listReplies', 'unreadReplyCount', 'markReplyRead', 'markAllRepliesRead',
  ];
  return { ...actual, bulkMessagesService: Object.fromEntries(fns.map((f) => [f, vi.fn()])) };
});

import { createApp } from '../../app';
import { bulkMessagesService as service } from './bulk-messages.service';

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;
const app = createApp();
const base = '/api/v1/admin/bulk-messages';
const ID = '11111111-1111-4111-8111-111111111111';
const admin = authHeader(Role.SUPER_ADMIN, 'admin-9');

beforeEach(() => vi.clearAllMocks());

describe('access', () => {
  const routes: [string, string][] = [
    ['get', '/summary'],
    ['get', '/templates'],
    ['post', '/templates'],
    ['post', '/templates/sync'],
    ['post', `/templates/${ID}/submit`],
    ['post', '/audience/preview'],
    ['post', '/test-send'],
    ['get', '/campaigns'],
    ['post', '/campaigns'],
    ['post', `/campaigns/${ID}/start`],
    ['get', `/campaigns/${ID}/export`],
    ['get', '/replies'],
  ];

  it.each(routes)('%s %s needs a token', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](`${base}${path}`);
    expect(res.status).toBe(401);
  });

  it.each(routes)('%s %s is refused to sellers, buyers and agents', async (method, path) => {
    for (const role of [Role.SELLER, Role.BUYER, Role.AGENT]) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](`${base}${path}`).set(authHeader(role));
      expect(res.status).toBe(403);
    }
  });
});

describe('templates', () => {
  const body = { name: 'festival_offer', body: 'Hello {{1}}, sale starts soon. Reply for more.', variableExamples: ['Asha'] };

  it('creates a draft and passes the admin id', async () => {
    svc.createTemplate.mockResolvedValue({ id: 't1' });
    const res = await request(app).post(`${base}/templates`).set(admin).send(body);
    expect(res.status).toBe(201);
    expect(svc.createTemplate).toHaveBeenCalledWith('admin-9', expect.objectContaining({ name: 'festival_offer', category: 'UTILITY', language: 'en' }));
  });

  it('rejects a body Meta would refuse, with the reason', async () => {
    const res = await request(app).post(`${base}/templates`).set(admin).send({ ...body, body: '{{1}} starts soon.' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toContain('start or end with a variable');
    expect(svc.createTemplate).not.toHaveBeenCalled();
  });

  it('submits to Meta', async () => {
    svc.submitTemplate.mockResolvedValue({ id: ID, status: 'PENDING' });
    const res = await request(app).post(`${base}/templates/${ID}/submit`).set(admin);
    expect(res.status).toBe(200);
    expect(svc.submitTemplate).toHaveBeenCalledWith('admin-9', ID);
  });

  it('lists with paging and a status filter', async () => {
    svc.listTemplates.mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get(`${base}/templates?status=APPROVED&page=2&limit=5`).set(admin);
    expect(res.status).toBe(200);
    expect(svc.listTemplates).toHaveBeenCalledWith({ status: 'APPROVED' }, { page: 2, limit: 5 });
    expect(res.body.meta).toMatchObject({ page: 2, limit: 5 });
  });

  it('syncs templates from Meta as the admin', async () => {
    svc.syncTemplates.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, skipped: [] });
    const res = await request(app).post(`${base}/templates/sync`).set(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ created: 1, updated: 0, unchanged: 0, skipped: [] });
    expect(svc.syncTemplates).toHaveBeenCalledWith('admin-9');
  });

  it('rejects a malformed id', async () => {
    expect((await request(app).post(`${base}/templates/not-a-uuid/submit`).set(admin)).status).toBe(422);
  });
});

describe('audience and campaigns', () => {
  it('previews an audience', async () => {
    svc.previewAudience.mockResolvedValue({ eligible: 3 });
    const res = await request(app).post(`${base}/audience/preview`).set(admin).send({ audience: { mode: 'ALL_LINKED' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ eligible: 3 });
  });

  it('refuses a PICKED audience with nobody picked', async () => {
    expect((await request(app).post(`${base}/audience/preview`).set(admin).send({ audience: { mode: 'PICKED' } })).status).toBe(422);
  });

  it('creates a campaign, then starts, pauses, resumes and cancels it as the admin', async () => {
    svc.createCampaign.mockResolvedValue({ id: ID });
    const created = await request(app)
      .post(`${base}/campaigns`)
      .set(admin)
      .send({ name: 'Diwali', templateId: ID, audience: { mode: 'ALL_LINKED' }, variableMapping: ['seller.contactName'] });
    expect(created.status).toBe(201);
    expect(svc.createCampaign).toHaveBeenCalledWith('admin-9', expect.objectContaining({ name: 'Diwali' }));

    for (const action of ['start', 'pause', 'resume', 'cancel']) {
      svc[action].mockResolvedValue({ id: ID });
      const res = await request(app).post(`${base}/campaigns/${ID}/${action}`).set(admin);
      expect(res.status).toBe(200);
      expect(svc[action]).toHaveBeenCalledWith('admin-9', ID);
    }
  });

  it('exports a CSV download', async () => {
    svc.exportCampaign.mockResolvedValue({ csv: 'Seller,Status\r\nBiz,SENT', filename: 'bulk-campaign-x.csv', rows: 1 });
    const res = await request(app).get(`${base}/campaigns/${ID}/export`).set(admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('bulk-campaign-x.csv');
    expect(res.text).toContain('Biz,SENT');
  });

  it('lists recipients by status', async () => {
    svc.listRecipients.mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get(`${base}/campaigns/${ID}/recipients?status=FAILED`).set(admin);
    expect(res.status).toBe(200);
    expect(svc.listRecipients).toHaveBeenCalledWith(ID, { status: 'FAILED' }, { page: 1, limit: 20 });
  });
});

describe('replies and test send', () => {
  it('lists unread replies and reports the unread count', async () => {
    svc.listReplies.mockResolvedValue({ data: [], total: 0 });
    svc.unreadReplyCount.mockResolvedValue(4);
    expect((await request(app).get(`${base}/replies?unread=true`).set(admin)).status).toBe(200);
    expect(svc.listReplies).toHaveBeenCalledWith({ campaignId: undefined, unread: true }, { page: 1, limit: 20 });
    expect((await request(app).get(`${base}/summary`).set(admin)).body.data).toEqual({ unreadReplies: 4 });
  });

  it('marks one reply, or all of them, as read', async () => {
    svc.markReplyRead.mockResolvedValue({});
    svc.markAllRepliesRead.mockResolvedValue(7);
    expect((await request(app).post(`${base}/replies/${ID}/read`).set(admin)).status).toBe(200);
    const all = await request(app).post(`${base}/replies/read-all`).set(admin);
    expect(all.body.data).toEqual({ marked: 7 });
  });

  it('sends a test message', async () => {
    svc.testSend.mockResolvedValue({ messageId: 'wamid.1' });
    const res = await request(app).post(`${base}/test-send`).set(admin).send({ templateId: ID, phone: '+919812340001', variables: ['Asha'] });
    expect(res.status).toBe(200);
    expect(svc.testSend).toHaveBeenCalledWith({ templateId: ID, phone: '+919812340001', variables: ['Asha'] });
  });
});
