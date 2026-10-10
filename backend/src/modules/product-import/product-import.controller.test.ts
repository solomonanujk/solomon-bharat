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

vi.mock('./product-import.service', () => ({
  productImportService: {
    previewForSeller: vi.fn(),
    previewForAdmin: vi.fn(),
    importForSeller: vi.fn(),
    importForAdmin: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { productImportService } from './product-import.service';
import type { ImportCandidate, ProductImportPreview } from './product-import.types';

const app = createApp();
const SELLER_PROFILE_ID = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';
const CSV = Buffer.from('Handle,Title,Variant Price\nmug,Mug,99\n');

const candidate: ImportCandidate = {
  key: 'mug',
  name: 'Mug',
  description: null,
  imageUrls: ['https://cdn.shopify.com/m.jpg'],
  sellerPrice: 99,
  variants: [],
  materials: null,
  issues: ['No description'],
};
const preview: ProductImportPreview = { source: 'shopify', products: [candidate], warnings: [] };

describe('product-import controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('POST /api/v1/product-import/preview', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/v1/product-import/preview');
      expect(res.status).toBe(401);
    });

    it('is SELLER only', async () => {
      const res = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.BUYER))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'text/csv' });
      expect(res.status).toBe(403);
      const admin = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SUPER_ADMIN))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'text/csv' });
      expect(admin.status).toBe(403);
    });

    it('returns the parsed preview in the envelope', async () => {
      vi.mocked(productImportService.previewForSeller).mockResolvedValue(preview);
      const res = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER, 'seller-user-1'))
        .attach('file', CSV, { filename: 'products_export.csv', contentType: 'text/csv' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: preview });
      expect(productImportService.previewForSeller).toHaveBeenCalledWith(
        'seller-user-1',
        expect.objectContaining({ originalname: 'products_export.csv', mimetype: 'text/csv' }),
      );
    });

    it('accepts .xlsx and the Windows .csv mimetype', async () => {
      vi.mocked(productImportService.previewForSeller).mockResolvedValue(preview);
      const xlsx = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('file', Buffer.from('PK'), {
          filename: 'p.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      expect(xlsx.status).toBe(200);
      const winCsv = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'application/vnd.ms-excel' });
      expect(winCsv.status).toBe(200);
    });

    it('400s when no file is sent', async () => {
      const res = await request(app).post('/api/v1/product-import/preview').set(authHeader(Role.SELLER));
      expect(res.status).toBe(400);
      expect(productImportService.previewForSeller).not.toHaveBeenCalled();
    });

    it('400s for a wrong extension or mismatched mimetype', async () => {
      const pdf = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('file', CSV, { filename: 'p.pdf', contentType: 'application/pdf' });
      expect(pdf.status).toBe(400);
      const mismatch = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'image/png' });
      expect(mismatch.status).toBe(400);
    });

    it('400s for a wrong field name and for files over 5 MB', async () => {
      const wrongField = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('spreadsheet', CSV, { filename: 'p.csv', contentType: 'text/csv' });
      expect(wrongField.status).toBe(400);

      const big = await request(app)
        .post('/api/v1/product-import/preview')
        .set(authHeader(Role.SELLER))
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 'a'), { filename: 'p.csv', contentType: 'text/csv' });
      expect(big.status).toBe(400);
      expect(big.body.message).toMatch(/5 MB/);
    });
  });

  describe('POST /api/v1/product-import/import', () => {
    it('creates products and returns 201 with the result', async () => {
      const result = { created: [{ id: 'p1', name: 'Mug', slug: 'mug' }], failed: [] };
      vi.mocked(productImportService.importForSeller).mockResolvedValue(result);
      const res = await request(app)
        .post('/api/v1/product-import/import')
        .set(authHeader(Role.SELLER, 'seller-user-1'))
        .send({ categoryId: CATEGORY_ID, products: [candidate] });
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(result);
      expect(productImportService.importForSeller).toHaveBeenCalledWith('seller-user-1', {
        categoryId: CATEGORY_ID,
        products: [candidate],
      });
    });

    it('returns 200 when nothing could be created', async () => {
      vi.mocked(productImportService.importForSeller).mockResolvedValue({
        created: [],
        failed: [{ key: 'mug', name: 'Mug', error: 'Could not create this product' }],
      });
      const res = await request(app)
        .post('/api/v1/product-import/import')
        .set(authHeader(Role.SELLER))
        .send({ categoryId: CATEGORY_ID, products: [candidate] });
      expect(res.status).toBe(200);
    });

    it('is SELLER only', async () => {
      const res = await request(app)
        .post('/api/v1/product-import/import')
        .set(authHeader(Role.BUYER))
        .send({ categoryId: CATEGORY_ID, products: [candidate] });
      expect(res.status).toBe(403);
    });

    it.each([
      ['no products', { categoryId: CATEGORY_ID, products: [] }],
      ['bad category id', { categoryId: 'nope', products: [candidate] }],
      ['non-http image', { categoryId: CATEGORY_ID, products: [{ ...candidate, imageUrls: ['javascript:alert(1)'] }] }],
      ['too many images', { categoryId: CATEGORY_ID, products: [{ ...candidate, imageUrls: Array(11).fill('https://x.test/a.jpg') }] }],
      ['name too long', { categoryId: CATEGORY_ID, products: [{ ...candidate, name: 'x'.repeat(61) }] }],
      ['negative price', { categoryId: CATEGORY_ID, products: [{ ...candidate, sellerPrice: -1 }] }],
      ['over 100 products', { categoryId: CATEGORY_ID, products: Array(101).fill(candidate) }],
    ])('422s for %s', async (_label, body) => {
      const res = await request(app).post('/api/v1/product-import/import').set(authHeader(Role.SELLER)).send(body);
      expect(res.status).toBe(422);
      expect(productImportService.importForSeller).not.toHaveBeenCalled();
    });
  });

  describe('admin on behalf of a seller', () => {
    it('preview is SUPER_ADMIN only', async () => {
      const res = await request(app)
        .post(`/api/v1/product-import/sellers/${SELLER_PROFILE_ID}/preview`)
        .set(authHeader(Role.SELLER))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'text/csv' });
      expect(res.status).toBe(403);
    });

    it('preview passes the seller profile id through', async () => {
      vi.mocked(productImportService.previewForAdmin).mockResolvedValue(preview);
      const res = await request(app)
        .post(`/api/v1/product-import/sellers/${SELLER_PROFILE_ID}/preview`)
        .set(authHeader(Role.SUPER_ADMIN))
        .attach('file', CSV, { filename: 'p.csv', contentType: 'text/csv' });
      expect(res.status).toBe(200);
      expect(productImportService.previewForAdmin).toHaveBeenCalledWith(SELLER_PROFILE_ID, expect.any(Object));
    });

    it('422s for a non-uuid seller profile id', async () => {
      const res = await request(app)
        .post('/api/v1/product-import/sellers/not-a-uuid/import')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ categoryId: CATEGORY_ID, products: [candidate] });
      expect(res.status).toBe(422);
    });

    it('import passes admin id + seller profile id', async () => {
      vi.mocked(productImportService.importForAdmin).mockResolvedValue({ created: [], failed: [] });
      const res = await request(app)
        .post(`/api/v1/product-import/sellers/${SELLER_PROFILE_ID}/import`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-user-1'))
        .send({ categoryId: CATEGORY_ID, products: [candidate] });
      expect(res.status).toBe(200);
      expect(productImportService.importForAdmin).toHaveBeenCalledWith('admin-user-1', SELLER_PROFILE_ID, {
        categoryId: CATEGORY_ID,
        products: [candidate],
      });
    });
  });
});
