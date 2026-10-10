import { Notification, NotificationType, Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { PaginationQuery } from '../../utils/pagination';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { mailProvider } from '../../providers/mail';
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
      `A payout of ₹${amount} has been marked as paid.`,
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

  notifyBrandApplicationApproved(brandUserId: string): Promise<Notification> {
    return this.notify(
      brandUserId,
      NotificationType.BRAND_APPLICATION_APPROVED,
      'Your brand is live on Solomon Bharat',
      'Your brand application has been approved. Complete your brand profile and publish your products.',
      '/portal',
    );
  }

  /**
   * Alerts a marketplace brand about a newly paid order (in-app + email). Never throws: a
   * failure here must not fail the payment settlement that triggered it.
   * The email shows items, qty and gross plus the buyer's city/country only; the portal has the rest.
   */
  async notifyBrandNewOrder(orderId: string): Promise<void> {
    try {
      const order = await this.repo.findOrderForBrandAlert(orderId);
      if (!order || !order.sellerProfile) return;
      const { user } = order.sellerProfile;
      const link = `/portal/orders/${orderId}`;

      await this.notify(
        user.id,
        NotificationType.NEW_ORDER_RECEIVED,
        'New order received',
        `You have a new paid order with ${order.items.length} item(s). Confirm it to start fulfilment.`,
        link,
      );

      const escape = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rows = order.items
        .map((i) => `<li>${escape(i.product.name)} &times; ${i.quantity} &mdash; ₹${i.lineAdminTotal.toString()}</li>`)
        .join('');
      const dest = order.shippingAddress
        ? `${escape(order.shippingAddress.city)}, ${escape(order.shippingAddress.country)}`
        : null;
      await mailProvider.sendMail({
        to: user.email,
        subject: 'New order on Solomon Bharat',
        html: `<p>You have received a new paid order.</p>
<ul>${rows}</ul>
<p>Order total: ₹${order.adminPriceTotal.toString()}${dest ? `<br/>Shipping to: ${dest}` : ''}</p>
<p>Open the order in your portal for full details: <a href="${env.APP_URL}${link}">${env.APP_URL}${link}</a></p>`,
      });
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to notify brand about new order');
    }
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
