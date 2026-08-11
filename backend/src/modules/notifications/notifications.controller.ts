import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { notificationsService } from './notifications.service';
import { ListQueryDto } from './notifications.validation';

export const notificationsController = {
  async list(req: Request, res: Response): Promise<void> {
    const { unreadOnly, ...pagination } = req.query as unknown as ListQueryDto;
    const { data, total } = await notificationsService.listForUser(req.user!.id, pagination, Boolean(unreadOnly));
    sendSuccess(res, data, 'Notifications retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async unreadCount(req: Request, res: Response): Promise<void> {
    const count = await notificationsService.countUnread(req.user!.id);
    sendSuccess(res, { count });
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const notification = await notificationsService.markRead(req.user!.id, req.params.id);
    sendSuccess(res, notification, 'Notification marked as read');
  },

  async markAllRead(req: Request, res: Response): Promise<void> {
    await notificationsService.markAllRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  },
};
