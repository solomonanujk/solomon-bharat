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

vi.mock('./collections.service', () => ({
  collectionsService: {
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    archive: vi.fn(),
    feature: vi.fn(),
    unfeature: vi.fn(),
    addProduct: vi.fn(),
    removeProduct: vi.fn(),
    reorderMembership: vi.fn(),
    listAdmin: vi.fn(),
    getAdminDetail: vi.fn(),
    listPublic: vi.fn(),
    listFeatured: vi.fn(),
    getPublicDetail: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    publishCollection: vi.fn(),
    unpublishToDraft: vi.fn(),
    archiveCollection: vi.fn(),
    setFeatured: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { collectionsService } from './collections.service';

const app = createApp();
const COLLECTION_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';

describe('collections controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET /api/v1/collections/featured', () => {
    it('returns featured collections with no auth required', async () => {
      vi.mocked(collectionsService.listFeatured).mockResolvedValue([{ id: COLLECTION_ID }] as never);
      const res = await request(app).get('/api/v1/collections/featured');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/collections', () => {
    it('returns published collections', async () => {
      vi.mocked(collectionsService.listPublic).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/collections');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/collections/:slug', () => {
    it('returns collection detail with product grid', async () => {
      vi.mocked(collectionsService.getPublicDetail).mockResolvedValue({
        collection: { id: COLLECTION_ID },
        products: [],
        total: 0,
        related: [],
      } as never);
      const res = await request(app).get('/api/v1/collections/sustainable-living');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/collections', () => {
    it('requires admin auth', async () => {
      const res = await request(app).post('/api/v1/collections').send({ name: 'New Collection' });
      expect(res.status).toBe(401);
    });

    it('creates a collection for SUPER_ADMIN', async () => {
      vi.mocked(collectionsService.createCollection).mockResolvedValue({ id: COLLECTION_ID } as never);
      const res = await request(app)
        .post('/api/v1/collections')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ name: 'New Collection' });
      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/v1/collections/:id/publish', () => {
    it('publishes a collection for SUPER_ADMIN', async () => {
      vi.mocked(collectionsService.publishCollection).mockResolvedValue({ id: COLLECTION_ID } as never);
      const res = await request(app)
        .post(`/api/v1/collections/${COLLECTION_ID}/publish`)
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/collections/:id/archive', () => {
    it('archives a collection for SUPER_ADMIN', async () => {
      vi.mocked(collectionsService.archiveCollection).mockResolvedValue({ id: COLLECTION_ID } as never);
      const res = await request(app)
        .post(`/api/v1/collections/${COLLECTION_ID}/archive`)
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/collections/:id/products', () => {
    it('adds an approved product to the collection', async () => {
      const res = await request(app)
        .post(`/api/v1/collections/${COLLECTION_ID}/products`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'))
        .send({ productId: PRODUCT_ID });
      expect(res.status).toBe(200);
      expect(collectionsService.addProduct).toHaveBeenCalledWith(
        COLLECTION_ID,
        { productId: PRODUCT_ID },
        'admin-1',
      );
    });

    it('rejects a non-uuid productId with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/collections/${COLLECTION_ID}/products`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ productId: 'not-a-uuid' });
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/v1/collections/:id/products/reorder', () => {
    it('reorders membership for SUPER_ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/collections/${COLLECTION_ID}/products/reorder`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send([{ productId: PRODUCT_ID, sortOrder: 0 }]);
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/collections/:id/products/:productId', () => {
    it('removes a product from the collection', async () => {
      const res = await request(app)
        .delete(`/api/v1/collections/${COLLECTION_ID}/products/${PRODUCT_ID}`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(collectionsService.removeProduct).toHaveBeenCalledWith(COLLECTION_ID, PRODUCT_ID, 'admin-1');
    });
  });

  describe('GET /api/v1/collections/admin', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/collections/admin');
      expect(res.status).toBe(401);
    });

    it('lists all collections for SUPER_ADMIN', async () => {
      vi.mocked(collectionsService.listAdmin).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/collections/admin').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });
});
