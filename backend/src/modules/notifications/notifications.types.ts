import { NotificationType } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export { NotificationType };
