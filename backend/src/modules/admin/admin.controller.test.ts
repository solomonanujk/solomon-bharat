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

vi.mock('./admin.service', () => ({
  adminService: {
    getDashboard: vi.fn(),
    getReport: vi.fn(),
    getReportAsCsv: vi.fn(),
    getAuditLog: vi.fn(),
    listSettings: vi.fn(),
    upsertSetting: vi.fn(),
    listUsers: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    promoteToAdmin: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { adminService } from './admin.service';

const app = createApp();
const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('admin controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires admin auth for every route under /admin', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin role with 403', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set(authHeader(Role.SELLER));
    expect(res.status).toBe(403);
  });

  describe('GET /api/v1/admin/dashboard', () => {
    it('returns the KPI summary for SUPER_ADMIN', async () => {
      vi.mocked(adminService.getDashboard).mockResolvedValue({ gmv: 1000 } as never);
      const res = await request(app).get('/api/v1/admin/dashboard').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/reports', () => {
    it('returns JSON rows by default', async () => {
      vi.mocked(adminService.getReport).mockResolvedValue([{ status: 'DELIVERED', count: 3 }] as never);
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .query({ type: 'orders-by-status' })
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('returns a CSV attachment when format=csv', async () => {
      vi.mocked(adminService.getReportAsCsv).mockResolvedValue('status,count\nDELIVERED,3' as never);
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .query({ type: 'orders-by-status', format: 'csv' })
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('orders-by-status.csv');
      expect(res.text).toContain('DELIVERED');
    });

    it('rejects an unknown report type with 422', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .query({ type: 'not-a-real-report' })
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/admin/audit-log', () => {
    it('lists audit log entries', async () => {
      vi.mocked(adminService.getAuditLog).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/admin/audit-log').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/settings', () => {
    it('lists platform settings', async () => {
      vi.mocked(adminService.listSettings).mockResolvedValue([] as never);
      const res = await request(app).get('/api/v1/admin/settings').set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/v1/admin/settings/:key', () => {
    it('saves a setting value', async () => {
      vi.mocked(adminService.upsertSetting).mockResolvedValue({ key: 'maintenance_mode', value: false } as never);
      const res = await request(app)
        .put('/api/v1/admin/settings/maintenance_mode')
        .set(authHeader(Role.SUPER_ADMIN))
        .send({ value: false });
      expect(res.status).toBe(200);
      expect(adminService.upsertSetting).toHaveBeenCalledWith('maintenance_mode', false);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('lists users, optionally filtered by role', async () => {
      vi.mocked(adminService.listUsers).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app)
        .get('/api/v1/admin/users')
        .query({ role: 'SELLER' })
        .set(authHeader(Role.SUPER_ADMIN));
      expect(res.status).toBe(200);
      expect(adminService.listUsers).toHaveBeenCalledWith({ role: 'SELLER' }, expect.any(Object));
    });
  });

  describe('POST /api/v1/admin/users/:id/suspend', () => {
    it('suspends a user account', async () => {
      vi.mocked(adminService.suspendUser).mockResolvedValue({ id: USER_ID, status: 'SUSPENDED' } as never);
      const res = await request(app)
        .post(`/api/v1/admin/users/${USER_ID}/suspend`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(adminService.suspendUser).toHaveBeenCalledWith(USER_ID, 'admin-1');
    });
  });

  describe('POST /api/v1/admin/users/:id/promote', () => {
    it('promotes a user to SUPER_ADMIN — a sensitive, admin-only role escalation', async () => {
      vi.mocked(adminService.promoteToAdmin).mockResolvedValue({ id: USER_ID, role: 'SUPER_ADMIN' } as never);
      const res = await request(app)
        .post(`/api/v1/admin/users/${USER_ID}/promote`)
        .set(authHeader(Role.SUPER_ADMIN, 'admin-1'));
      expect(res.status).toBe(200);
      expect(adminService.promoteToAdmin).toHaveBeenCalledWith(USER_ID, 'admin-1');
    });

    it('is not reachable by a non-admin', async () => {
      const res = await request(app).post(`/api/v1/admin/users/${USER_ID}/promote`).set(authHeader(Role.BUYER));
      expect(res.status).toBe(403);
    });
  });
});
