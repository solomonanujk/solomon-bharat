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

vi.mock('./categories.service', () => ({
  categoriesService: {
    getPublicTree: vi.fn(),
    getAdminTree: vi.fn(),
    getCategoryDetailBySlug: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    archiveCategory: vi.fn(),
    restoreCategory: vi.fn(),
    reorderSiblings: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { categoriesService } from './categories.service';

const app = createApp();
const PARENT_ID = '11111111-1111-1111-1111-111111111111';

describe('categories controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET /api/v1/categories', () => {
    it('returns the public tree with no auth required', async () => {
      vi.mocked(categoriesService.getPublicTree).mockResolvedValue([{ id: 'c1' }] as never);
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'c1' }]);
    });
  });

  describe('GET /api/v1/categories/admin/tree', () => {
    it('requires admin auth', async () => {
      const res = await request(app).get('/api/v1/categories/admin/tree');
      expect(res.status).toBe(401);
    });

    it('returns the admin tree for SUPER_ADMIN', async () => {
      vi.mocked(categoriesService.getAdminTree).mockResolvedValue([{ id: 'c1' }] as never);
      const res = await request(app).get('/api/v1/categories/admin/tree').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });

    it('rejects a SELLER with 403', async () => {
      const res = await request(app).get('/api/v1/categories/admin/tree').set(authHeader(Role.SELLER));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/categories/:slug', () => {
    it('returns category detail', async () => {
      vi.mocked(categoriesService.getCategoryDetailBySlug).mockResolvedValue({ id: 'c1', slug: 'home-decor' } as never);
      const res = await request(app).get('/api/v1/categories/home-decor');
      expect(res.status).toBe(200);
      expect(categoriesService.getCategoryDetailBySlug).toHaveBeenCalledWith('home-decor', false);
    });
  });

  describe('POST /api/v1/categories', () => {
    it('requires admin auth', async () => {
      const res = await request(app).post('/api/v1/categories').send({ name: 'Home Décor', level: 1 });
      expect(res.status).toBe(401);
    });

    it('creates a level 1 category with no parent for SUPER_ADMIN', async () => {
      vi.mocked(categoriesService.createCategory).mockResolvedValue({ id: 'c1', name: 'Home Décor' } as never);
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ name: 'Home Décor', level: 1 });
      expect(res.status).toBe(201);
    });

    it('rejects a level 1 category that includes a parentId', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ name: 'Home Décor', level: 1, parentId: PARENT_ID });
      expect(res.status).toBe(422);
      expect(categoriesService.createCategory).not.toHaveBeenCalled();
    });

    it('rejects a level 2 category missing a parentId', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ name: 'Textiles', level: 2 });
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/v1/categories/reorder', () => {
    it('reorders siblings for SUPER_ADMIN', async () => {
      const res = await request(app)
        .patch('/api/v1/categories/reorder')
        .set(authHeader(Role.SUPER_ADMIN))
        .send([{ id: PARENT_ID, sortOrder: 0 }]);
      expect(res.status).toBe(200);
      expect(categoriesService.reorderSiblings).toHaveBeenCalledWith([{ id: PARENT_ID, sortOrder: 0 }]);
    });

    it('rejects an empty reorder list', async () => {
      const res = await request(app).patch('/api/v1/categories/reorder').set(authHeader(Role.SUPER_ADMIN)).send([]);
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('updates a category for SUPER_ADMIN', async () => {
      vi.mocked(categoriesService.updateCategory).mockResolvedValue({ id: PARENT_ID, name: 'Updated' } as never);
      const res = await request(app)
        .patch(`/api/v1/categories/${PARENT_ID}`)
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/categories/:id/archive', () => {
    it('archives a category for SUPER_ADMIN', async () => {
      vi.mocked(categoriesService.archiveCategory).mockResolvedValue({ id: PARENT_ID, status: 'ARCHIVED' } as never);
      const res = await request(app)
        .post(`/api/v1/categories/${PARENT_ID}/archive`)
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });

    it('surfaces a 409 when the service reports active products remain', async () => {
      const { AppError } = await import('../../utils/errors');
      vi.mocked(categoriesService.archiveCategory).mockRejectedValue(
        AppError.conflict('3 product(s) assigned. Reassign them before archiving.', { count: 3 }),
      );
      const res = await request(app)
        .post(`/api/v1/categories/${PARENT_ID}/archive`)
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(409);
      expect(res.body.meta.details).toEqual({ count: 3 });
    });
  });

  describe('POST /api/v1/categories/:id/restore', () => {
    it('restores a category for SUPER_ADMIN', async () => {
      vi.mocked(categoriesService.restoreCategory).mockResolvedValue({ id: PARENT_ID, status: 'ACTIVE' } as never);
      const res = await request(app)
        .post(`/api/v1/categories/${PARENT_ID}/restore`)
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });
});
