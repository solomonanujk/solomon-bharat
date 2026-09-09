import { Notification, NotificationType, Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { PaginationQuery } from '../../utils/pagination';
import { NotificationsRepository, notificationsRepository } from './notifications.repository';

export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository = notificationsRepository) {}

  notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<Notification> {
    return this.repo.create({ userId, type, title, message, link });
  }

  async notifyAllAdmins(type: NotificationType, title: string, message: string, link?: string): Promise<void> {
    const adminIds = await this.repo.findUserIdsByRole(Role.SUPER_ADMIN);
    await Promise.all(adminIds.map((id) => this.repo.create({ userId: id, type, title, message, link })));
  }

  // ── Convenience wrappers for the modules that trigger notifications ──

  notifyProductApproved(sellerUserId: string, productName: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.PRODUCT_APPROVED,
      'Product approved',
      `"${productName}" has been approved and published to the marketplace.`,
    );
  }

  notifyProductRejected(sellerUserId: string, productName: string, reason: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.PRODUCT_REJECTED,
      'Product rejected',
      `"${productName}" was rejected: ${reason}`,
    );
  }

  notifyPricingChangeApproved(sellerUserId: string, productName: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.PRODUCT_PRICING_CHANGE_APPROVED,
      'Pricing change approved',
      `Your pricing/variant update for "${productName}" has been approved and is now live.`,
    );
  }

  notifyPricingChangeRejected(sellerUserId: string, productName: string, reason: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.PRODUCT_PRICING_CHANGE_REJECTED,
      'Pricing change rejected',
      `Your pricing/variant update for "${productName}" was rejected: ${reason}`,
    );
  }

  notifyOrderStatusChanged(buyerUserId: string, orderId: string, status: string): Promise<Notification> {
    return this.notify(
      buyerUserId,
      NotificationType.ORDER_STATUS_CHANGED,
      'Order status updated',
      `Your order is now ${status.replace(/_/g, ' ').toLowerCase()}.`,
      `/orders/${orderId}`,
    );
  }

  notifyPayoutPaid(sellerUserId: string, amount: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.PAYOUT_PAID,
      'Payout paid',
      `A payout of $${amount} has been marked as paid.`,
    );
  }

  notifySellerApplicationApproved(sellerUserId: string): Promise<Notification> {
    return this.notify(
      sellerUserId,
      NotificationType.SELLER_APPLICATION_APPROVED,
      'Welcome to Solomon Bharat',
      'Your seller application has been approved.',
    );
  }

  notifyAgentApplicationApproved(agentUserId: string): Promise<Notification> {
    return this.notify(
      agentUserId,
      NotificationType.AGENT_APPLICATION_APPROVED,
      'Welcome to Solomon Bharat',
      'Your agent application has been approved.',
    );
  }

  notifyAgentApplicationRejected(agentUserId: string, reason?: string): Promise<Notification> {
    return this.notify(
      agentUserId,
      NotificationType.AGENT_APPLICATION_REJECTED,
      'Update on your agent application',
      reason ? `Your agent application was rejected: ${reason}` : 'Your agent application was rejected.',
    );
  }

  notifyNewMessageToAdmins(): Promise<void> {
    return this.notifyAllAdmins(
      NotificationType.NEW_MESSAGE,
      'New buyer message',
      'A buyer has sent a new message.',
    );
  }

  notifyNewMessageToBuyer(buyerUserId: string): Promise<Notification> {
    return this.notify(
      buyerUserId,
      NotificationType.NEW_MESSAGE,
      'New message from Solomon Bharat',
      'You have a new reply from our team.',
    );
  }

  // ── Reader API ─────────────────────────────────────────────────────

  async listForUser(userId: string, pagination: PaginationQuery, unreadOnly: boolean) {
    return this.repo.findForUser(userId, pagination, unreadOnly);
  }

  async countUnread(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.repo.findById(id);
    if (!notification || notification.userId !== userId) {
      throw AppError.notFound('Notification not found');
    }
    return this.repo.markRead(id);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }
}

export const notificationsService = new NotificationsService();
