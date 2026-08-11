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

vi.mock('./sellers.service', () => ({
  sellersService: {
    submitApplication: vi.fn(),
    listApplications: vi.fn(),
    getApplicationDetail: vi.fn(),
    approveApplication: vi.fn(),
    rejectApplication: vi.fn(),
    requestMoreInfo: vi.fn(),
    addInternalNote: vi.fn(),
    listSellers: vi.fn(),
    getSellerDetailForAdmin: vi.fn(),
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { sellersService } from './sellers.service';

const app = createApp();
const APP_ID = '11111111-1111-1111-1111-111111111111';

describe('sellers controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('POST /api/v1/sellers/apply', () => {
    it('submits an application with no auth required', async () => {
      vi.mocked(sellersService.submitApplication).mockResolvedValue({ id: APP_ID } as never);
      const res = await request(app).post('/api/v1/sellers/apply').send({
        businessName: 'Kala Kendra',
        contactName: 'Meera',
        email: 'meera@kalakendra.in',
        phone: '9876543210',
        businessAddress: '221B Baker St, Mumbai',
      });
      expect(res.status).toBe(201);
    });

    it('rejects a missing businessName with 422', async () => {
      const res = await request(app).post('/api/v1/sellers/apply').send({
        contactName: 'Meera',
        email: 'meera@kalakendra.in',
        phone: '9876543210',
        businessAddress: '221B Baker St',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/sellers/applications', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/sellers/applications');
      expect(res.status).toBe(401);
    });

    it('lists applications for SUPER_ADMIN', async () => {
      vi.mocked(sellersService.listApplications).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/sellers/applications').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/sellers/applications/:id/approve', () => {
    it('approves the application and creates the seller account', async () => {
      vi.mocked(sellersService.approveApplication).mockResolvedValue({ id: APP_ID } as never);
      const res = await request(app)
        .post(`/api/v1/sellers/applications/${APP_ID}/approve`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(sellersService.approveApplication).toHaveBeenCalledWith(APP_ID, 'admin-1');
    });
  });

  describe('POST /api/v1/sellers/applications/:id/reject', () => {
    it('rejects with a reason', async () => {
      vi.mocked(sellersService.rejectApplication).mockResolvedValue({ id: APP_ID } as never);
      const res = await request(app)
        .post(`/api/v1/sellers/applications/${APP_ID}/reject`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ reason: 'Incomplete address' });
      expect(res.status).toBe(200);
    });

    it('rejects an empty reason with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/sellers/applications/${APP_ID}/reject`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ reason: '' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/sellers/me', () => {
    it('requires seller auth', async () => {
      const res = await request(app).get('/api/v1/sellers/me');
      expect(res.status).toBe(401);
    });

    it('returns my own profile for SELLER', async () => {
      vi.mocked(sellersService.getMyProfile).mockResolvedValue({ id: 'sp1' } as never);
      const res = await request(app).get('/api/v1/sellers/me').set(authHeader(Role.SELLER, 'seller-user-1'));
      expect(res.status).toBe(200);
      expect(sellersService.getMyProfile).toHaveBeenCalledWith('seller-user-1');
    });

    it('rejects a BUYER with 403', async () => {
      const res = await request(app).get('/api/v1/sellers/me').set(authHeader(Role.BUYER));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/sellers/me', () => {
    it('updates my own profile for SELLER', async () => {
      vi.mocked(sellersService.updateMyProfile).mockResolvedValue({ id: 'sp1', businessName: 'Updated' } as never);
      const res = await request(app)
        .patch('/api/v1/sellers/me')
        .set(authHeader(Role.SELLER))
        .send({ businessName: 'Updated' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/sellers', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/sellers');
      expect(res.status).toBe(401);
    });

    it('lists sellers for SUPER_ADMIN', async () => {
      vi.mocked(sellersService.listSellers).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/sellers').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/sellers/:id', () => {
    it('returns seller detail for SUPER_ADMIN', async () => {
      vi.mocked(sellersService.getSellerDetailForAdmin).mockResolvedValue({ id: APP_ID } as never);
      const res = await request(app).get(`/api/v1/sellers/${APP_ID}`).set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });
});
