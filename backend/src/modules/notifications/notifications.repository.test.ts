import { describe, it, expect, beforeEach } from 'vitest';
import { Role } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  let db: MockPrismaClient;
  let repo: NotificationsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({ notification: mockModel(), user: mockModel() });
    repo = new NotificationsRepository(db as never);
  });

  it('create passes the input straight through as data', async () => {
    db.notification.create.mockResolvedValue({ id: 'n1' });
    await repo.create({ userId: 'u1', type: 'PRODUCT_APPROVED', title: 'Approved', body: 'Your product is live' } as never);
    expect(db.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'PRODUCT_APPROVED', title: 'Approved', body: 'Your product is live' },
    });
  });

  it('findForUser scopes to unread only when requested', async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);
    await repo.findForUser('u1', { page: 1, limit: 20 }, true);
    const arg = db.notification.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1', isRead: false });
  });

  it('findForUser returns all notifications when unreadOnly is false', async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);
    await repo.findForUser('u1', { page: 1, limit: 20 }, false);
    const arg = db.notification.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1' });
  });

  it('markRead sets isRead true', async () => {
    db.notification.update.mockResolvedValue({ id: 'n1' });
    await repo.markRead('n1');
    expect(db.notification.update).toHaveBeenCalledWith({ where: { id: 'n1' }, data: { isRead: true } });
  });

  it('markAllRead only touches currently-unread notifications for that user', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 3 });
    await repo.markAllRead('u1');
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isRead: false },
      data: { isRead: true },
    });
  });

  it('countUnread counts unread notifications for the user', async () => {
    db.notification.count.mockResolvedValue(4);
    await expect(repo.countUnread('u1')).resolves.toBe(4);
    expect(db.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', isRead: false } });
  });

  it('findUserIdsByRole maps selected users down to just their ids', async () => {
    db.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const ids = await repo.findUserIdsByRole(Role.SUPER_ADMIN);
    expect(db.user.findMany).toHaveBeenCalledWith({ where: { role: Role.SUPER_ADMIN }, select: { id: true } });
    expect(ids).toEqual(['u1', 'u2']);
  });
});
