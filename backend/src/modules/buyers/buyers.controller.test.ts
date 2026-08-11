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

vi.mock('./buyers.service', () => ({
  buyersService: {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    listAddresses: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
    setDefaultAddress: vi.fn(),
    listWishlist: vi.fn(),
    addToWishlist: vi.fn(),
    removeFromWishlist: vi.fn(),
    getMyConversation: vi.fn(),
    sendMessageAsBuyer: vi.fn(),
    listBuyersForAdmin: vi.fn(),
    getBuyerForAdmin: vi.fn(),
    getConversationForAdmin: vi.fn(),
    sendMessageAsAdmin: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { buyersService } from './buyers.service';

const app = createApp();
const ADDRESS_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const BUYER_ID = '33333333-3333-3333-3333-333333333333';

describe('buyers controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buyersService.getMyProfile).mockResolvedValue({ id: 'buyer-profile-1' } as never);
  });

  describe('GET /api/v1/buyers/me', () => {
    it('requires buyer auth', async () => {
      const res = await request(app).get('/api/v1/buyers/me');
      expect(res.status).toBe(401);
    });

    it('returns my profile for BUYER', async () => {
      const res = await request(app).get('/api/v1/buyers/me').set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });

    it('rejects a SELLER with 403', async () => {
      const res = await request(app).get('/api/v1/buyers/me').set(authHeader(Role.SELLER));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/buyers/me/addresses', () => {
    it('creates an address for BUYER', async () => {
      vi.mocked(buyersService.createAddress).mockResolvedValue({ id: ADDRESS_ID } as never);
      const res = await request(app)
        .post('/api/v1/buyers/me/addresses')
        .set(authHeader(Role.BUYER))
        .send({ line1: '221B Baker St', city: 'Mumbai', postalCode: '400001', country: 'IN' });
      expect(res.status).toBe(201);
      expect(buyersService.createAddress).toHaveBeenCalledWith('buyer-profile-1', expect.any(Object));
    });

    it('rejects a missing line1 with 422', async () => {
      const res = await request(app)
        .post('/api/v1/buyers/me/addresses')
        .set(authHeader(Role.BUYER))
        .send({ city: 'Mumbai', postalCode: '400001', country: 'IN' });
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/v1/buyers/me/addresses/:id', () => {
    it('deletes an address for BUYER', async () => {
      const res = await request(app)
        .delete(`/api/v1/buyers/me/addresses/${ADDRESS_ID}`)
        .set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(buyersService.deleteAddress).toHaveBeenCalledWith('buyer-profile-1', ADDRESS_ID);
    });
  });

  describe('POST /api/v1/buyers/me/addresses/:id/default', () => {
    it('sets the default address for BUYER', async () => {
      vi.mocked(buyersService.setDefaultAddress).mockResolvedValue({ id: ADDRESS_ID, isDefault: true } as never);
      const res = await request(app)
        .post(`/api/v1/buyers/me/addresses/${ADDRESS_ID}/default`)
        .set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/buyers/me/wishlist', () => {
    it('lists my wishlist for BUYER', async () => {
      vi.mocked(buyersService.listWishlist).mockResolvedValue([] as never);
      const res = await request(app).get('/api/v1/buyers/me/wishlist').set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/buyers/me/wishlist', () => {
    it('adds a product to my wishlist', async () => {
      const res = await request(app)
        .post('/api/v1/buyers/me/wishlist')
        .set(authHeader(Role.BUYER))
        .send({ productId: PRODUCT_ID });
      expect(res.status).toBe(200);
      expect(buyersService.addToWishlist).toHaveBeenCalledWith('buyer-profile-1', PRODUCT_ID);
    });
  });

  describe('DELETE /api/v1/buyers/me/wishlist/:productId', () => {
    it('removes a product from my wishlist', async () => {
      const res = await request(app)
        .delete(`/api/v1/buyers/me/wishlist/${PRODUCT_ID}`)
        .set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(buyersService.removeFromWishlist).toHaveBeenCalledWith('buyer-profile-1', PRODUCT_ID);
    });
  });

  describe('GET /api/v1/buyers/me/messages', () => {
    it('returns my conversation with Solomon Bharat', async () => {
      vi.mocked(buyersService.getMyConversation).mockResolvedValue([] as never);
      const res = await request(app).get('/api/v1/buyers/me/messages').set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/buyers/me/messages', () => {
    it('sends a message as the buyer', async () => {
      vi.mocked(buyersService.sendMessageAsBuyer).mockResolvedValue({ id: 'm1' } as never);
      const res = await request(app)
        .post('/api/v1/buyers/me/messages')
        .set(authHeader(Role.BUYER))
        .send({ body: 'When will my order ship?' });
      expect(res.status).toBe(201);
    });

    it('rejects an empty body with 422', async () => {
      const res = await request(app).post('/api/v1/buyers/me/messages').set(authHeader(Role.BUYER)).send({ body: '' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/buyers/admin', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/buyers/admin');
      expect(res.status).toBe(401);
    });

    it('lists buyers for SUPER_ADMIN', async () => {
      vi.mocked(buyersService.listBuyersForAdmin).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/buyers/admin').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/buyers/admin/:id/messages', () => {
    it('replies to a buyer as admin', async () => {
      vi.mocked(buyersService.sendMessageAsAdmin).mockResolvedValue({ id: 'm1' } as never);
      const res = await request(app)
        .post(`/api/v1/buyers/admin/${BUYER_ID}/messages`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ body: 'Your order ships tomorrow.' });
      expect(res.status).toBe(201);
      expect(buyersService.sendMessageAsAdmin).toHaveBeenCalledWith(BUYER_ID, 'Your order ships tomorrow.');
    });
  });
});
