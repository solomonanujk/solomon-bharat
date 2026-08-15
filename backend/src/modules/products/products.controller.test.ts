import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

import { buildCatchAllMockPrisma } from '../../test-utils/mockPrisma';

vi.mock('../../middleware/rateLimiter', () => ({
  publicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// createApp() wires every module's real routes, which would otherwise instantiate a real
// PrismaClient/Redis connection at import time — sandbox controller tests from all real infra.
vi.mock('../../config/prisma', () => ({ prisma: buildCatchAllMockPrisma() }));
vi.mock('../../config/redis', () => ({
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn() },
}));

vi.mock('./products.service', () => ({
  productsService: {
    create: vi.fn(),
    update: vi.fn(),
    resubmitProduct: vi.fn(),
    deleteProduct: vi.fn(),
    listMine: vi.fn(),
    listAdmin: vi.fn(),
    listPublic: vi.fn(),
    getMine: vi.fn(),
    getAdmin: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    updatePrice: vi.fn(),
    reassignCategory: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    feature: vi.fn(),
    unfeature: vi.fn(),
    listForSeller: vi.fn(),
    listForAdmin: vi.fn(),
    listPublished: vi.fn(),
    getBySlug: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    getForSeller: vi.fn(),
    getForAdmin: vi.fn(),
    approveProduct: vi.fn(),
    rejectProduct: vi.fn(),
    setPublished: vi.fn(),
    setFeatured: vi.fn(),
  },
}));

vi.mock('../sellers/sellers.service', () => ({
  sellersService: {
    getMyProfile: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { productsService } from './products.service';
import { sellersService } from '../sellers/sellers.service';

const app = createApp();
const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';

describe('products controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sellersService.getMyProfile).mockResolvedValue({ id: 'seller-profile-1' } as never);
  });

  describe('GET /api/v1/products/me', () => {
    it('requires seller auth', async () => {
      const res = await request(app).get('/api/v1/products/me');
      expect(res.status).toBe(401);
    });

    it('lists the seller\'s own products', async () => {
      vi.mocked(productsService.listForSeller).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/products/me').set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
      expect(productsService.listForSeller).toHaveBeenCalledWith('seller-profile-1', {}, expect.any(Object));
    });

    it('rejects a BUYER with 403', async () => {
      const res = await request(app).get('/api/v1/products/me').set(authHeader(Role.BUYER));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/products/me/:id/resubmit', () => {
    it('resubmits a rejected product', async () => {
      vi.mocked(productsService.resubmitProduct).mockResolvedValue({ id: PRODUCT_ID } as never);
      const res = await request(app)
        .post(`/api/v1/products/me/${PRODUCT_ID}/resubmit`)
        .set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
      expect(productsService.resubmitProduct).toHaveBeenCalledWith('seller-profile-1', PRODUCT_ID);
    });
  });

  describe('DELETE /api/v1/products/me/:id', () => {
    it('soft-deletes the seller\'s own product', async () => {
      const res = await request(app).delete(`/api/v1/products/me/${PRODUCT_ID}`).set(authHeader(Role.SELLER));
      expect(res.status).toBe(200);
      expect(productsService.deleteProduct).toHaveBeenCalledWith('seller-profile-1', PRODUCT_ID);
    });
  });

  describe('GET /api/v1/products/admin', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/products/admin');
      expect(res.status).toBe(401);
    });

    it('lists products for SUPER_ADMIN', async () => {
      vi.mocked(productsService.listForAdmin).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/products/admin').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/products/admin/:id/approve', () => {
    const TIER_ID = '22222222-2222-2222-2222-222222222222';

    it('approves with a valid per-tier adminPrice', async () => {
      vi.mocked(productsService.approveProduct).mockResolvedValue({ id: PRODUCT_ID } as never);
      const res = await request(app)
        .post(`/api/v1/products/admin/${PRODUCT_ID}/approve`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ priceTiers: [{ id: TIER_ID, adminPrice: 25 }] });
      expect(res.status).toBe(200);
      expect(productsService.approveProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        [{ id: TIER_ID, adminPrice: 25 }],
        undefined,
        expect.any(String),
      );
    });

    it('rejects a request with no tiers priced with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/products/admin/${PRODUCT_ID}/approve`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/products/admin/:id/reject', () => {
    it('rejects with a reason', async () => {
      vi.mocked(productsService.rejectProduct).mockResolvedValue({ id: PRODUCT_ID } as never);
      const res = await request(app)
        .post(`/api/v1/products/admin/${PRODUCT_ID}/reject`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ reason: 'Images unclear' });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/v1/products/admin/:id/category', () => {
    it('reassigns the category for SUPER_ADMIN', async () => {
      vi.mocked(productsService.reassignCategory).mockResolvedValue({ id: PRODUCT_ID } as never);
      const res = await request(app)
        .patch(`/api/v1/products/admin/${PRODUCT_ID}/category`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ categoryId: CATEGORY_ID });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/products (public)', () => {
    it('requires a category or collection scope, enforced by the service', async () => {
      const { AppError } = await import('../../utils/errors');
      vi.mocked(productsService.listPublished).mockRejectedValue(
        AppError.badRequest('A category or collection scope is required for product search'),
      );
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(400);
    });

    it('returns products scoped to a category', async () => {
      vi.mocked(productsService.listPublished).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/products').query({ categoryId: CATEGORY_ID });
      expect(res.status).toBe(200);
      expect(productsService.listPublished).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID }),
        expect.any(Object),
      );
    });
  });

  describe('GET /api/v1/products/:slug', () => {
    it('returns product detail with related products', async () => {
      vi.mocked(productsService.getBySlug).mockResolvedValue({
        product: { id: PRODUCT_ID, slug: 'table-runner' },
        related: [],
      } as never);
      const res = await request(app).get('/api/v1/products/table-runner');
      expect(res.status).toBe(200);
      expect(res.body.data.product.slug).toBe('table-runner');
    });
  });

  describe('POST /api/v1/products', () => {
    it('creates a product with attached images for SELLER', async () => {
      vi.mocked(productsService.createProduct).mockResolvedValue({ id: PRODUCT_ID } as never);

      const res = await request(app)
        .post('/api/v1/products')
        .set(authHeader(Role.SELLER))
        .field('name', 'Table Runner')
        .field('description', 'A handwoven table runner')
        .field('categoryId', CATEGORY_ID)
        .field('materials', 'Cotton')
        .field('moq', '10')
        .field('declaredStock', '100')
        .field('sellerPrice', '5.5')
        .field('weight', '0.5')
        .attach('images', Buffer.from('fake-image-1'), 'one.jpg')
        .attach('images', Buffer.from('fake-image-2'), 'two.jpg');

      expect(res.status).toBe(201);
      expect(productsService.createProduct).toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .field('name', 'Table Runner')
        .field('description', 'desc')
        .field('categoryId', CATEGORY_ID)
        .field('materials', 'Cotton')
        .field('moq', '10')
        .field('declaredStock', '100')
        .field('sellerPrice', '5');
      expect(res.status).toBe(401);
    });
  });
});
