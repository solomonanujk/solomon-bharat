import { Notification, PrismaClient, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { CreateNotificationInput } from './notifications.types';

export class NotificationsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    return this.db.notification.create({ data: input });
  }

  async findForUser(
    userId: string,
    pagination: PaginationQuery,
    unreadOnly: boolean,
  ): Promise<{ data: Notification[]; total: number }> {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [data, total] = await Promise.all([
      this.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.notification.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<Notification | null> {
    return this.db.notification.findUnique({ where: { id } });
  }

  markRead(id: string): Promise<Notification> {
    return this.db.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  countUnread(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, isRead: false } });
  }

  async findUserIdsByRole(role: Role): Promise<string[]> {
    const users = await this.db.user.findMany({ where: { role }, select: { id: true } });
    return users.map((u) => u.id);
  }
}

export const notificationsRepository = new NotificationsRepository();
