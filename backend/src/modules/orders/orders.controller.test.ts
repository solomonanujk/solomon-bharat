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

vi.mock('./orders.service', () => ({
  ordersService: {
    listMyOrders: vi.fn(),
    getMyOrder: vi.fn(),
    listItemsForSeller: vi.fn(),
    listForAdmin: vi.fn(),
    getForAdmin: vi.fn(),
    confirmOrder: vi.fn(),
    procureOrder: vi.fn(),
    collectOrder: vi.fn(),
    shipOrder: vi.fn(),
    deliverOrder: vi.fn(),
    cancelOrder: vi.fn(),
    setTrackingNumber: vi.fn(),
    setExportDocuments: vi.fn(),
  },
}));

vi.mock('../sellers/sellers.service', () => ({
  sellersService: { getMyProfile: vi.fn() },
}));

vi.mock('../buyers/buyers.service', () => ({
  buyersService: { getMyProfile: vi.fn() },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { ordersService } from './orders.service';
import { sellersService } from '../sellers/sellers.service';
import { buyersService } from '../buyers/buyers.service';

const app = createApp();
const ORDER_ID = '11111111-1111-1111-1111-111111111111';

describe('orders controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buyersService.getMyProfile).mockResolvedValue({ id: 'buyer-profile-1' } as never);
    vi.mocked(sellersService.getMyProfile).mockResolvedValue({ id: 'seller-profile-1' } as never);
  });

  describe('GET /api/v1/orders/me', () => {
    it('requires buyer auth', async () => {
      const res = await request(app).get('/api/v1/orders/me');
      expect(res.status).toBe(401);
    });

    it('lists my orders for BUYER', async () => {
      vi.mocked(ordersService.listMyOrders).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/orders/me').set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(ordersService.listMyOrders).toHaveBeenCalledWith('buyer-profile-1', expect.any(Object));
    });
  });

  describe('GET /api/v1/orders/me/:id', () => {
    it('returns one of my own orders', async () => {
      vi.mocked(ordersService.getMyOrder).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app).get(`/api/v1/orders/me/${ORDER_ID}`).set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/orders/seller/items', () => {
    it('requires seller auth', async () => {
      const res = await request(app).get('/api/v1/orders/seller/items');
      expect(res.status).toBe(401);
    });

    it('lists order items linked to the seller\'s products', async () => {
      vi.mocked(ordersService.listItemsForSeller).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/orders/seller/items').set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
      expect(ordersService.listItemsForSeller).toHaveBeenCalledWith('seller-profile-1', expect.any(Object));
    });
  });

  describe('GET /api/v1/orders/admin', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/orders/admin');
      expect(res.status).toBe(401);
    });

    it('lists all orders for SUPER_ADMIN', async () => {
      vi.mocked(ordersService.listForAdmin).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/orders/admin').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/orders/admin/:id/confirm', () => {
    it('confirms a paid order for SUPER_ADMIN', async () => {
      vi.mocked(ordersService.confirmOrder).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/confirm`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(ordersService.confirmOrder).toHaveBeenCalledWith(ORDER_ID, 'admin-1');
    });
  });

  describe('POST /api/v1/orders/admin/:id/procure', () => {
    it('moves an order to procuring with an optional expected collection date', async () => {
      vi.mocked(ordersService.procureOrder).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/procure`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ expectedCollectionDate: '2026-08-20' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/orders/admin/:id/ship', () => {
    it('marks an order in transit', async () => {
      vi.mocked(ordersService.shipOrder).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/ship`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ trackingNumber: 'TRACK123' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/orders/admin/:id/cancel', () => {
    it('cancels an order with a reason', async () => {
      vi.mocked(ordersService.cancelOrder).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/cancel`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ reason: 'Buyer requested cancellation' });
      expect(res.status).toBe(200);
    });

    it('rejects a missing reason with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/cancel`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/v1/orders/admin/:id/tracking', () => {
    it('updates the tracking number', async () => {
      vi.mocked(ordersService.setTrackingNumber).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .patch(`/api/v1/orders/admin/${ORDER_ID}/tracking`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ trackingNumber: 'TRACK456' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/orders/admin/:id/export-documents', () => {
    it('attaches export documents given valid URLs', async () => {
      vi.mocked(ordersService.setExportDocuments).mockResolvedValue({ id: ORDER_ID } as never);
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/export-documents`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ documents: ['https://cdn.example.com/invoice.pdf'] });
      expect(res.status).toBe(200);
    });

    it('rejects a non-url document with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/admin/${ORDER_ID}/export-documents`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ documents: ['not-a-url'] });
      expect(res.status).toBe(422);
    });
  });
});
