import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notification, NotificationType, Role } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.ORDER_STATUS_CHANGED,
    title: 'Order status updated',
    message: 'Your order is now confirmed.',
    link: null,
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): NotificationsRepository {
  return {
    create: vi.fn(),
    findForUser: vi.fn(),
    findById: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    countUnread: vi.fn(),
    findUserIdsByRole: vi.fn(),
  } as unknown as NotificationsRepository;
}

describe('NotificationsService', () => {
  let repo: NotificationsRepository;
  let service: NotificationsService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new NotificationsService(repo);
  });

  describe('markRead', () => {
    it('rejects marking another user\'s notification as read', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildNotification({ userId: 'someone-else' }));

      await expect(service.markRead('user-1', 'notif-1')).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.markRead).not.toHaveBeenCalled();
    });

    it('marks the notification read when owned by the requester', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildNotification());
      vi.mocked(repo.markRead).mockResolvedValue(buildNotification({ isRead: true }));

      const result = await service.markRead('user-1', 'notif-1');

      expect(repo.markRead).toHaveBeenCalledWith('notif-1');
      expect(result.isRead).toBe(true);
    });
  });

  describe('notifyAllAdmins', () => {
    it('fans out one notification per SUPER_ADMIN user', async () => {
      vi.mocked(repo.findUserIdsByRole).mockResolvedValue(['admin-1', 'admin-2']);
      vi.mocked(repo.create).mockResolvedValue(buildNotification());

      await service.notifyAllAdmins(NotificationType.NEW_MESSAGE, 'New message', 'A buyer messaged you');

      expect(repo.findUserIdsByRole).toHaveBeenCalledWith(Role.SUPER_ADMIN);
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', type: NotificationType.NEW_MESSAGE }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-2', type: NotificationType.NEW_MESSAGE }),
      );
    });
  });

  describe('convenience wrappers', () => {
    beforeEach(() => {
      vi.mocked(repo.create).mockResolvedValue(buildNotification());
    });

    it('notifyProductApproved sends a PRODUCT_APPROVED notification with the product name', async () => {
      await service.notifyProductApproved('user-1', 'Table Runner');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.PRODUCT_APPROVED,
          message: expect.stringContaining('Table Runner'),
        }),
      );
    });

    it('notifyProductRejected includes the rejection reason in the message', async () => {
      await service.notifyProductRejected('user-1', 'Table Runner', 'blurry photos');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.PRODUCT_REJECTED,
          message: expect.stringContaining('blurry photos'),
        }),
      );
    });

    it('notifyOrderStatusChanged links back to the order', async () => {
      await service.notifyOrderStatusChanged('user-1', 'order-1', 'IN_TRANSIT');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.ORDER_STATUS_CHANGED,
          link: '/orders/order-1',
          message: expect.stringContaining('in transit'),
        }),
      );
    });

    it('notifyPayoutPaid includes the amount', async () => {
      await service.notifyPayoutPaid('user-1', '50.00');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.PAYOUT_PAID, message: expect.stringContaining('50.00') }),
      );
    });

    it('notifySellerApplicationApproved sends a welcome notification', async () => {
      await service.notifySellerApplicationApproved('user-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: NotificationType.SELLER_APPLICATION_APPROVED }),
      );
    });

    it('notifyNewMessageToBuyer notifies the specific buyer', async () => {
      await service.notifyNewMessageToBuyer('buyer-user-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'buyer-user-1', type: NotificationType.NEW_MESSAGE }),
      );
    });
  });

  describe('reader API', () => {
    it('listForUser passes unreadOnly through to the repository', async () => {
      vi.mocked(repo.findForUser).mockResolvedValue({ data: [], total: 0 });

      await service.listForUser('user-1', { page: 1, limit: 20 }, true);

      expect(repo.findForUser).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 }, true);
    });

    it('countUnread delegates to the repository', async () => {
      vi.mocked(repo.countUnread).mockResolvedValue(3);

      await expect(service.countUnread('user-1')).resolves.toBe(3);
    });

    it('markAllRead delegates to the repository', async () => {
      await service.markAllRead('user-1');

      expect(repo.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });
});
