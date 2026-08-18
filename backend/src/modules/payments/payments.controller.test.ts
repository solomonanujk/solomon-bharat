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

vi.mock('./payments.service', () => ({
  paymentsService: {
    checkout: vi.fn(),
    capture: vi.fn(),
    getPaymentStatus: vi.fn(),
    getInvoice: vi.fn(),
  },
}));

vi.mock('../buyers/buyers.service', () => ({
  buyersService: { getMyProfile: vi.fn() },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { paymentsService } from './payments.service';
import { buyersService } from '../buyers/buyers.service';

const app = createApp();
const PAYMENT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '33333333-3333-3333-3333-333333333333';

describe('payments controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buyersService.getMyProfile).mockResolvedValue({ id: 'buyer-profile-1' } as never);
  });

  describe('POST /api/v1/payments/checkout', () => {
    it('requires buyer auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .send({ items: [{ productId: PRODUCT_ID, quantity: 1 }] });
      expect(res.status).toBe(401);
    });

    it('creates a checkout for BUYER', async () => {
      vi.mocked(paymentsService.checkout).mockResolvedValue({ orderId: ORDER_ID, approveUrl: 'https://paypal' } as never);
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set(authHeader(Role.BUYER))
        .send({ items: [{ productId: PRODUCT_ID, quantity: 2 }] });
      expect(res.status).toBe(201);
      expect(paymentsService.checkout).toHaveBeenCalledWith(
        'buyer-profile-1',
        expect.objectContaining({ items: [{ productId: PRODUCT_ID, quantity: 2 }] }),
        'BUYER',
      );
    });

    it('rejects an empty items array with 422', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set(authHeader(Role.BUYER))
        .send({ items: [] });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/payments/:id/capture', () => {
    it('captures a completed payment', async () => {
      vi.mocked(paymentsService.capture).mockResolvedValue({ id: PAYMENT_ID, status: 'COMPLETED' } as never);
      const res = await request(app).post(`/api/v1/payments/${PAYMENT_ID}/capture`).set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Payment captured');
    });

    it('reports a failed capture with the same 200 envelope but a failure message', async () => {
      vi.mocked(paymentsService.capture).mockResolvedValue({ id: PAYMENT_ID, status: 'FAILED' } as never);
      const res = await request(app).post(`/api/v1/payments/${PAYMENT_ID}/capture`).set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Payment failed');
    });
  });

  describe('GET /api/v1/payments/:id', () => {
    it('returns payment status for the owning buyer', async () => {
      vi.mocked(paymentsService.getPaymentStatus).mockResolvedValue({ id: PAYMENT_ID, status: 'PENDING' } as never);
      const res = await request(app).get(`/api/v1/payments/${PAYMENT_ID}`).set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/payments/orders/:orderId/invoice', () => {
    it('resolves the buyer profile id for a BUYER requester', async () => {
      vi.mocked(paymentsService.getInvoice).mockResolvedValue({ orderId: ORDER_ID } as never);
      const res = await request(app)
        .get(`/api/v1/payments/orders/${ORDER_ID}/invoice`)
        .set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(paymentsService.getInvoice).toHaveBeenCalledWith('buyer-profile-1', Role.BUYER, ORDER_ID);
    });

    it('uses the raw user id (not a buyer profile) for a SUPER_ADMIN requester', async () => {
      vi.mocked(paymentsService.getInvoice).mockResolvedValue({ orderId: ORDER_ID } as never);
      const res = await request(app)
        .get(`/api/v1/payments/orders/${ORDER_ID}/invoice`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(paymentsService.getInvoice).toHaveBeenCalledWith('admin-1', Role.SUPER_ADMIN, ORDER_ID);
      expect(buyersService.getMyProfile).not.toHaveBeenCalled();
    });

    it('requires auth', async () => {
      const res = await request(app).get(`/api/v1/payments/orders/${ORDER_ID}/invoice`);
      expect(res.status).toBe(401);
    });
  });
});
