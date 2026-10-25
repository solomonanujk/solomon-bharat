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
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn() },
}));
vi.mock('./whatsapp.admin.service', () => ({
  whatsAppAdminService: {
    summary: vi.fn(),
    products: vi.fn(),
    liveListings: vi.fn(),
    linkedSellers: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { whatsAppAdminService as service } from './whatsapp.admin.service';

const app = createApp();
const base = '/api/v1/whatsapp/admin';
const paths = ['summary', 'products', 'sessions', 'sellers'];

beforeEach(() => vi.clearAllMocks());

describe('admin WhatsApp routes: access', () => {
  it.each(paths)('GET /%s needs a token', async (path) => {
    expect((await request(app).get(`${base}/${path}`)).status).toBe(401);
  });

  it.each(paths)('GET /%s is refused to sellers and buyers', async (path) => {
    expect((await request(app).get(`${base}/${path}`).set(authHeader(Role.SELLER))).status).toBe(403);
    expect((await request(app).get(`${base}/${path}`).set(authHeader(Role.BUYER))).status).toBe(403);
  });
});

describe('admin WhatsApp routes: data', () => {
  const admin = authHeader(Role.SUPER_ADMIN);

  it('summary', async () => {
    vi.mocked(service.summary).mockResolvedValue({ pendingProducts: 2, liveListings: 1, linkedSellers: 4 });
    const res = await request(app).get(`${base}/summary`).set(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ pendingProducts: 2, liveListings: 1, linkedSellers: 4 });
  });

  it('products passes the status and seller filter with paging', async () => {
    vi.mocked(service.products).mockResolvedValue({ data: [], total: 0 } as never);
    const sellerId = '11111111-1111-4111-8111-111111111111';
    const res = await request(app).get(`${base}/products?approvalStatus=PENDING&sellerId=${sellerId}&page=2&limit=5`).set(admin);
    expect(res.status).toBe(200);
    expect(service.products).toHaveBeenCalledWith({ approvalStatus: 'PENDING', sellerId }, { page: 2, limit: 5 });
    expect(res.body.meta).toMatchObject({ page: 2, limit: 5, total: 0 });
  });

  it('products rejects a bad status', async () => {
    expect((await request(app).get(`${base}/products?approvalStatus=NOPE`).set(admin)).status).toBe(422);
  });

  it('sessions lists listings in progress', async () => {
    vi.mocked(service.liveListings).mockResolvedValue({ data: [{ productName: 'Diya' }], total: 1 } as never);
    const res = await request(app).get(`${base}/sessions`).set(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ productName: 'Diya' }]);
    expect(service.liveListings).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('sellers passes the search text', async () => {
    vi.mocked(service.linkedSellers).mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get(`${base}/sellers?search=brass`).set(admin);
    expect(res.status).toBe(200);
    expect(service.linkedSellers).toHaveBeenCalledWith({ search: 'brass' }, { page: 1, limit: 20 });
  });
});
