import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { idParamSchema, listQuerySchema } from './notifications.validation';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const notificationsRouter = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List my notifications (any authenticated role)
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Notifications list }
 */
notificationsRouter.get(
  '/',
  requireAuth,
  validate(listQuerySchema, 'query'),
  asyncHandler(notificationsController.list),
);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     summary: Get my unread notification count
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Unread count }
 */
notificationsRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(notificationsController.unreadCount),
);

/**
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Notification marked as read }
 */
notificationsRouter.post(
  '/:id/read',
  requireAuth,
  validate(idParamSchema, 'params'),
  asyncHandler(notificationsController.markRead),
);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     summary: Mark all my notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200: { description: All notifications marked as read }
 */
notificationsRouter.post('/read-all', requireAuth, asyncHandler(notificationsController.markAllRead));
