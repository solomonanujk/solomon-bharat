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

vi.mock('./payouts.service', () => ({
  payoutsService: {
    listForSeller: vi.fn(),
    getSellerSummary: vi.fn(),
    listForAdmin: vi.fn(),
    getForAdmin: vi.fn(),
    markAsPaid: vi.fn(),
    addNotes: vi.fn(),
  },
}));

vi.mock('../sellers/sellers.service', () => ({
  sellersService: { getMyProfile: vi.fn() },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { payoutsService } from './payouts.service';
import { sellersService } from '../sellers/sellers.service';

const app = createApp();
const PAYOUT_ID = '11111111-1111-1111-1111-111111111111';

describe('payouts controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sellersService.getMyProfile).mockResolvedValue({ id: 'seller-profile-1' } as never);
  });

  describe('GET /api/v1/payouts/me', () => {
    it('requires seller auth', async () => {
      const res = await request(app).get('/api/v1/payouts/me');
      expect(res.status).toBe(401);
    });

    it('lists my payouts for SELLER', async () => {
      vi.mocked(payoutsService.listForSeller).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/payouts/me').set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
      expect(payoutsService.listForSeller).toHaveBeenCalledWith('seller-profile-1', {}, expect.any(Object));
    });
  });

  describe('GET /api/v1/payouts/me/summary', () => {
    it('returns my payout summary for SELLER', async () => {
      vi.mocked(payoutsService.getSellerSummary).mockResolvedValue({
        totalEarned: 500,
        pending: 100,
        lastPaidAt: null,
      } as never);
      const res = await request(app).get('/api/v1/payouts/me/summary').set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/payouts/admin', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/payouts/admin');
      expect(res.status).toBe(401);
    });

    it('lists all payouts for SUPER_ADMIN', async () => {
      vi.mocked(payoutsService.listForAdmin).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/payouts/admin').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/payouts/admin/:id/mark-paid', () => {
    it('marks a payout as paid, no self-service withdrawal — admin-only', async () => {
      vi.mocked(payoutsService.markAsPaid).mockResolvedValue({ id: PAYOUT_ID, status: 'PAID' } as never);
      const res = await request(app)
        .post(`/api/v1/payouts/admin/${PAYOUT_ID}/mark-paid`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
        .send({ notes: 'Paid via NEFT' });
      expect(res.status).toBe(200);
      expect(payoutsService.markAsPaid).toHaveBeenCalledWith(PAYOUT_ID, 'Paid via NEFT', 'admin-1');
    });

    it('rejects a SELLER attempting to mark their own payout paid', async () => {
      const res = await request(app)
        .post(`/api/v1/payouts/admin/${PAYOUT_ID}/mark-paid`)
        .set(authHeader(Role.SELLER))
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/payouts/admin/:id/notes', () => {
    it('updates notes for SUPER_ADMIN', async () => {
      vi.mocked(payoutsService.addNotes).mockResolvedValue({ id: PAYOUT_ID } as never);
      const res = await request(app)
        .patch(`/api/v1/payouts/admin/${PAYOUT_ID}/notes`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ notes: 'Bank details confirmed' });
      expect(res.status).toBe(200);
    });

    it('rejects an empty notes string with 422', async () => {
      const res = await request(app)
        .patch(`/api/v1/payouts/admin/${PAYOUT_ID}/notes`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ notes: '' });
      expect(res.status).toBe(422);
    });
  });
});
