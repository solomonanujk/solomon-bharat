import { Notification, NotificationType, Role } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { PaginationQuery } from '../../utils/pagination';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { mailProvider } from '../../providers/mail';
import { normalizeWhatsAppNumber, whatsAppProvider } from '../../providers/whatsapp';
import { emailButton, emailLayout, escapeHtml } from '../../utils/emailTemplates';
import { NotificationsRepository, notificationsRepository } from './notifications.repository';

/** Short human order number, matching the admin/portal UIs (last 8 chars of the id, upper-case). */
function orderRef(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository = notificationsRepository) {}

  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<Notification> {
    const notification = await this.repo.create({ userId, type, title, message, link });
    // WhatsApp copy of the same notice. Never awaited by callers' success path: a failure is logged only.
    void this.sendWhatsApp(userId, title, message, link);
    return notification;
  }

  private async sendWhatsApp(userId: string, title: string, message: string, link?: string): Promise<void> {
    try {
      const to = normalizeWhatsAppNumber(await this.repo.findUserPhone(userId));
      if (!to) return;
      const url = link ? `\n${env.APP_URL}${link}` : '';
      await whatsAppProvider.sendText(to, `Solomon Bharat: ${title}\n${message}${url}`);
    } catch (err) {
      logger.error({ err, userId }, 'WhatsApp notification failed');
    }
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

      const escape = escapeHtml;
      const rows = order.items
        .map((i) => `<li>${escape(i.product.name)} &times; ${i.quantity} &mdash; ₹${i.lineAdminTotal.toString()}</li>`)
        .join('');
      const dest = order.shippingAddress
        ? `${escape(order.shippingAddress.city)}, ${escape(order.shippingAddress.country)}`
        : null;
      const url = `${env.APP_URL}${link}`;
      await mailProvider.sendMail({
        to: user.email,
        subject: 'New order — please accept',
        html: emailLayout(`<p>You have received a new paid order <strong>#${orderRef(orderId)}</strong>. Please accept it in your portal within 24 hours, or it will be cancelled automatically.</p>
<p>Items to fulfil:</p>
<ul>${rows}</ul>
<p>Order total: ₹${order.adminPriceTotal.toString()}${dest ? `<br/>Shipping to: ${dest}` : ''}</p>
${emailButton(url, 'Review and accept the order')}
<p style="font-size:13px;color:#555555;">Or open: <a href="${escape(url)}" style="color:#8a3b12;">${escape(url)}</a></p>`),
      });
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to notify brand about new order');
    }
  }

  /**
   * Alerts every active SUPER_ADMIN about a newly paid (placed) order: in-app + email with the
   * order number, buyer, total, item count and a link to the admin order page. Never throws:
   * a failure here must not fail the payment settlement that triggered it.
   */
  async notifyAdminsNewOrder(orderId: string): Promise<void> {
    try {
      const order = await this.repo.findOrderForAdminAlert(orderId);
      if (!order) return;
      const admins = await this.repo.findActiveUsersByRole(Role.SUPER_ADMIN);
      if (admins.length === 0) return;

      const ref = orderRef(order.id);
      const link = `/admin/orders/${order.id}`;
      const url = `${env.APP_URL}${link}`;
      const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
      const lineCount = order.items.length;
      const buyerName = order.buyer.companyName
        ? `${order.buyer.companyName} (${order.buyer.contactName})`
        : order.buyer.contactName;
      const total = `₹${order.adminPriceTotal.toString()}`;
      const fulfiller = order.sellerProfile ? `Brand: ${order.sellerProfile.businessName}` : 'Curated (Solomon Bharat)';
      const message = `Order #${ref} from ${buyerName} — ${total}, ${itemCount} item(s).`;

      await Promise.all(
        admins.map(async (admin) => {
          try {
            await this.repo.create({
              userId: admin.id,
              type: NotificationType.NEW_ORDER_RECEIVED,
              title: 'New order placed',
              message,
              link,
            });
          } catch (err) {
            logger.error({ err, orderId, adminId: admin.id }, 'Failed to create admin new-order notification');
          }
          try {
            await mailProvider.sendMail({
              to: admin.email,
              subject: 'New order on Solomon Bharat',
              html: emailLayout(`<p>A new order has been paid on Solomon Bharat.</p>
<table role="presentation" cellspacing="0" cellpadding="4" border="0" style="font-size:15px;">
<tr><td style="color:#555555;">Order</td><td><strong>#${ref}</strong></td></tr>
<tr><td style="color:#555555;">Buyer</td><td>${escapeHtml(buyerName)}${order.placedAsAgent ? ' (agent)' : ''}<br/><span style="color:#555555;">${escapeHtml(order.buyer.user.email)} · ${escapeHtml(order.buyer.country)}</span></td></tr>
<tr><td style="color:#555555;">Total</td><td>${total}</td></tr>
<tr><td style="color:#555555;">Items</td><td>${itemCount} (${lineCount} line${lineCount === 1 ? '' : 's'})</td></tr>
<tr><td style="color:#555555;">Fulfilment</td><td>${escapeHtml(fulfiller)}</td></tr>
</table>
${emailButton(url, 'Open the order')}
<p style="font-size:13px;color:#555555;">Or open: <a href="${escapeHtml(url)}" style="color:#8a3b12;">${escapeHtml(url)}</a></p>`),
            });
          } catch (err) {
            logger.error({ err, orderId, adminId: admin.id }, 'Failed to email admin about new order');
          }
        }),
      );
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to notify admins about new order');
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
