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

vi.mock('./notifications.service', () => ({
  notificationsService: {
    listForUser: vi.fn(),
    countUnread: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { notificationsService } from './notifications.service';

const app = createApp();
const NOTIFICATION_ID = '11111111-1111-1111-1111-111111111111';

describe('notifications controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET /api/v1/notifications', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('lists notifications for any authenticated role', async () => {
      vi.mocked(notificationsService.listForUser).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app).get('/api/v1/notifications').set(authHeader(Role.SELLER, 'seller-user-1'));
      expect(res.status).toBe(200);
      expect(notificationsService.listForUser).toHaveBeenCalledWith('seller-user-1', expect.any(Object), false);
    });

    it('passes unreadOnly through when set', async () => {
      vi.mocked(notificationsService.listForUser).mockResolvedValue({ data: [], total: 0 } as never);
      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ unreadOnly: 'true' })
        .set(authHeader(Role.BUYER, 'buyer-user-1'));
      expect(res.status).toBe(200);
      expect(notificationsService.listForUser).toHaveBeenCalledWith('buyer-user-1', expect.any(Object), true);
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns the unread count', async () => {
      vi.mocked(notificationsService.countUnread).mockResolvedValue(5);
      const res = await request(app).get('/api/v1/notifications/unread-count').set(authHeader(Role.BUYER));
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(5);
    });
  });

  describe('POST /api/v1/notifications/:id/read', () => {
    it('marks a notification read', async () => {
      vi.mocked(notificationsService.markRead).mockResolvedValue({ id: NOTIFICATION_ID, isRead: true } as never);
      const res = await request(app)
        .post(`/api/v1/notifications/${NOTIFICATION_ID}/read`)
        .set(authHeader(Role.BUYER, 'buyer-user-1'));
      expect(res.status).toBe(200);
      expect(notificationsService.markRead).toHaveBeenCalledWith('buyer-user-1', NOTIFICATION_ID);
    });
  });

  describe('POST /api/v1/notifications/read-all', () => {
    it('marks all notifications read', async () => {
      const res = await request(app).post('/api/v1/notifications/read-all').set(authHeader(Role.BUYER, 'buyer-user-1'));
      expect(res.status).toBe(200);
      expect(notificationsService.markAllRead).toHaveBeenCalledWith('buyer-user-1');
    });
  });
});
