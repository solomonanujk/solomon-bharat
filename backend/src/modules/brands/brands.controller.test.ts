import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';
import { buildCatchAllMockPrisma } from '../../test-utils/mockPrisma';

vi.mock('../../middleware/rateLimiter', () => ({
  publicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));


vi.mock('../../config/prisma', () => ({ prisma: buildCatchAllMockPrisma() }));
vi.mock('../../config/redis', () => ({
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn() },
}));

vi.mock('./brands.service', () => ({
  brandsService: {
    listPublic: vi.fn(),
    getPublicBySlug: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
    listFollowing: vi.fn(),
    getMyBrand: vi.fn(),
    updateMyBrand: vi.fn(),
    uploadMyBrandImage: vi.fn(),
    getMyStats: vi.fn(),
    listForAdmin: vi.fn(),
    updateForAdmin: vi.fn(),
    getCommissionDefaults: vi.fn(),
    setCommissionDefaults: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { brandsService } from './brands.service';
import { prisma } from '../../config/prisma';

const app = createApp();
const BRAND_ID = '11111111-1111-1111-1111-111111111111';

function asMarketplaceSeller() {
  vi.mocked(prisma.sellerProfile.findFirst).mockResolvedValue({ sellerType: 'MARKETPLACE' } as never);
}

describe('brands controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /brands is public and paginated', async () => {
    vi.mocked(brandsService.listPublic).mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get('/api/v1/brands?search=kala');
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 0, page: 1 });
    expect(brandsService.listPublic).toHaveBeenCalledWith('kala', { page: 1, limit: 20 }, undefined);
  });

  it('GET /brands/:slug is public', async () => {
    vi.mocked(brandsService.getPublicBySlug).mockResolvedValue({ slug: 'kk' } as never);
    const res = await request(app).get('/api/v1/brands/kk');
    expect(res.status).toBe(200);
    expect(brandsService.getPublicBySlug).toHaveBeenCalledWith('kk', undefined);
  });

  it('static paths are not swallowed by /:slug', async () => {
    const res = await request(app).get('/api/v1/brands/me');
    expect(res.status).toBe(401);
    expect(brandsService.getPublicBySlug).not.toHaveBeenCalled();
  });

  it('follow / unfollow require a buyer', async () => {
    expect((await request(app).post('/api/v1/brands/kk/follow')).status).toBe(401);
    expect((await request(app).post('/api/v1/brands/kk/follow').set(authHeader(Role.SELLER))).status).toBe(403);

    vi.mocked(brandsService.follow).mockResolvedValue({ isFollowing: true });
    const ok = await request(app).post('/api/v1/brands/kk/follow').set(authHeader(Role.BUYER, 'u1'));
    expect(ok.status).toBe(200);
    expect(brandsService.follow).toHaveBeenCalledWith('u1', 'kk');

    vi.mocked(brandsService.unfollow).mockResolvedValue({ isFollowing: false });
    const del = await request(app).delete('/api/v1/brands/kk/follow').set(authHeader(Role.BUYER, 'u1'));
    expect(del.status).toBe(200);
  });

  it('GET /brands/following lists for a buyer', async () => {
    vi.mocked(brandsService.listFollowing).mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get('/api/v1/brands/following').set(authHeader(Role.BUYER, 'u1'));
    expect(res.status).toBe(200);
  });

  it('/brands/me rejects curated sellers and non-sellers', async () => {
    vi.mocked(prisma.sellerProfile.findFirst).mockResolvedValue({ sellerType: 'CURATED' } as never);
    expect((await request(app).get('/api/v1/brands/me').set(authHeader(Role.SELLER))).status).toBe(403);
    expect((await request(app).get('/api/v1/brands/me').set(authHeader(Role.BUYER))).status).toBe(403);
  });

  it('marketplace seller can read and patch their brand, but not rename it', async () => {
    asMarketplaceSeller();
    vi.mocked(brandsService.getMyBrand).mockResolvedValue({ id: 'b' } as never);
    expect((await request(app).get('/api/v1/brands/me').set(authHeader(Role.SELLER, 's1'))).status).toBe(200);

    vi.mocked(brandsService.updateMyBrand).mockResolvedValue({ id: 'b' } as never);
    const ok = await request(app)
      .patch('/api/v1/brands/me')
      .set(authHeader(Role.SELLER, 's1'))
      .send({ story: 'Hello', minOrderValueInr: 3000 });
    expect(ok.status).toBe(200);
    expect(brandsService.updateMyBrand).toHaveBeenCalledWith('s1', { story: 'Hello', minOrderValueInr: 3000 });

    const rename = await request(app)
      .patch('/api/v1/brands/me')
      .set(authHeader(Role.SELLER, 's1'))
      .send({ name: 'Hacked', slug: 'hacked' });
    expect(rename.status).toBe(422);
  });

  it('stats route is wired for marketplace sellers', async () => {
    asMarketplaceSeller();
    vi.mocked(brandsService.getMyStats).mockResolvedValue({ ordersCount: 1 } as never);
    const res = await request(app).get('/api/v1/brands/me/stats').set(authHeader(Role.SELLER, 's1'));
    expect(res.status).toBe(200);
    expect(res.body.data.ordersCount).toBe(1);
  });

  it('logo upload passes the multipart file to the service', async () => {
    asMarketplaceSeller();
    vi.mocked(brandsService.uploadMyBrandImage).mockResolvedValue({ url: 'https://cdn/x.png' });
    const res = await request(app)
      .post('/api/v1/brands/me/logo')
      .set(authHeader(Role.SELLER, 's1'))
      .attach('file', Buffer.from('png'), { filename: 'l.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://cdn/x.png');
    expect(brandsService.uploadMyBrandImage).toHaveBeenCalledWith('s1', 'logo', expect.objectContaining({ originalname: 'l.png' }));
  });

  it('admin routes require SUPER_ADMIN', async () => {
    expect((await request(app).get('/api/v1/brands/admin').set(authHeader(Role.BUYER))).status).toBe(403);
    expect((await request(app).get('/api/v1/brands/admin/commission-defaults').set(authHeader(Role.SELLER))).status).toBe(403);

    vi.mocked(brandsService.listForAdmin).mockResolvedValue({ data: [], total: 0 });
    const res = await request(app).get('/api/v1/brands/admin?status=ACTIVE').set(authHeader(Role.SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(brandsService.listForAdmin).toHaveBeenCalledWith({ status: 'ACTIVE', search: undefined }, { page: 1, limit: 20 });
  });

  it('PATCH /brands/admin/:id validates the body', async () => {
    const bad = await request(app)
      .patch(`/api/v1/brands/admin/${BRAND_ID}`)
      .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
      .send({ commissionFirstOverride: 150 });
    expect(bad.status).toBe(422);

    const empty = await request(app)
      .patch(`/api/v1/brands/admin/${BRAND_ID}`)
      .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
      .send({});
    expect(empty.status).toBe(422);

    vi.mocked(brandsService.updateForAdmin).mockResolvedValue({ id: BRAND_ID } as never);
    const ok = await request(app)
      .patch(`/api/v1/brands/admin/${BRAND_ID}`)
      .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
      .send({ isVerified: true, commissionRepeatOverride: null });
    expect(ok.status).toBe(200);
    expect(brandsService.updateForAdmin).toHaveBeenCalledWith('admin-1', BRAND_ID, {
      isVerified: true,
      commissionRepeatOverride: null,
    });
  });

  it('PUT /brands/admin/commission-defaults validates range', async () => {
    const bad = await request(app)
      .put('/api/v1/brands/admin/commission-defaults')
      .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
      .send({ first: 25, repeat: 101 });
    expect(bad.status).toBe(422);

    vi.mocked(brandsService.setCommissionDefaults).mockResolvedValue({ first: 25, repeat: 15 });
    const ok = await request(app)
      .put('/api/v1/brands/admin/commission-defaults')
      .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
      .send({ first: 25, repeat: 15 });
    expect(ok.status).toBe(200);
    expect(brandsService.setCommissionDefaults).toHaveBeenCalledWith('admin-1', { first: 25, repeat: 15 });
  });
});
