import { logger } from '../../config/logger';
import { WhatsAppProvider, WhatsAppTemplate } from './types';

/**
 * WhatsApp only lets a business start a conversation, or message someone silent for 24 hours,
 * with a template approved in advance. Each message below has its own template and its own
 * setting. A setting left empty means "not set up": the plain text goes out as before (which only
 * arrives inside the 24-hour window).
 */

/** The settings, one per template. Meta: template name. Twilio: Content SID (HX...). */
export interface TemplateSettings {
  WHATSAPP_TEMPLATE_AUTH: string;
  WHATSAPP_TEMPLATE_PRODUCT_APPROVED: string;
  WHATSAPP_TEMPLATE_PRODUCT_REJECTED: string;
  WHATSAPP_TEMPLATE_PRICING_APPROVED: string;
  WHATSAPP_TEMPLATE_PRICING_REJECTED: string;
  WHATSAPP_TEMPLATE_ORDER_STATUS: string;
  WHATSAPP_TEMPLATE_PAYOUT_PAID: string;
  WHATSAPP_TEMPLATE_SELLER_APPROVED: string;
  WHATSAPP_TEMPLATE_AGENT_APPROVED: string;
  WHATSAPP_TEMPLATE_NEW_MESSAGE: string;
  /** Meta language code of all templates (Twilio ignores it). */
  WHATSAPP_TEMPLATE_LANGUAGE: string;
}

/** Every template setting empty: tests and callers spread this and fill in what they need. */
export const EMPTY_TEMPLATE_SETTINGS: TemplateSettings = {
  WHATSAPP_TEMPLATE_AUTH: '',
  WHATSAPP_TEMPLATE_PRODUCT_APPROVED: '',
  WHATSAPP_TEMPLATE_PRODUCT_REJECTED: '',
  WHATSAPP_TEMPLATE_PRICING_APPROVED: '',
  WHATSAPP_TEMPLATE_PRICING_REJECTED: '',
  WHATSAPP_TEMPLATE_ORDER_STATUS: '',
  WHATSAPP_TEMPLATE_PAYOUT_PAID: '',
  WHATSAPP_TEMPLATE_SELLER_APPROVED: '',
  WHATSAPP_TEMPLATE_AGENT_APPROVED: '',
  WHATSAPP_TEMPLATE_NEW_MESSAGE: '',
  WHATSAPP_TEMPLATE_LANGUAGE: 'en',
};

/** Each builder returns null while its template is not set up. */
export interface TemplateCatalog {
  /** Verification code; also fills the copy-code button of an authentication template. */
  authCode(code: string): WhatsAppTemplate | null;
  /** {{1}} product name. */
  productApproved(productName: string): WhatsAppTemplate | null;
  /** {{1}} product name, {{2}} reason. */
  productRejected(productName: string, reason: string): WhatsAppTemplate | null;
  /** {{1}} product name. */
  pricingApproved(productName: string): WhatsAppTemplate | null;
  /** {{1}} product name, {{2}} reason. */
  pricingRejected(productName: string, reason: string): WhatsAppTemplate | null;
  /** {{1}} short order number, {{2}} new status in words. */
  orderStatus(orderRef: string, status: string): WhatsAppTemplate | null;
  /** {{1}} amount in rupees. */
  payoutPaid(amount: string): WhatsAppTemplate | null;
  /** No variables. */
  sellerApproved(): WhatsAppTemplate | null;
  /** No variables. */
  agentApproved(): WhatsAppTemplate | null;
  /** No variables. */
  newMessage(): WhatsAppTemplate | null;
}

/**
 * Template values may not contain line breaks or tabs and Meta rejects long runs of spaces, so
 * free text (a product name, an admin's reason) is flattened and capped. Never empty.
 */
export function templateParam(value: string, max = 200): string {
  const flat = value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max).trim();
  return flat || '-';
}

export function createTemplateCatalog(s: TemplateSettings): TemplateCatalog {
  const language = s.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const make = (name: string, body: string[], copyCode?: string): WhatsAppTemplate | null =>
    name ? { name, language, body, ...(copyCode ? { copyCode } : {}) } : null;

  return {
    authCode: (code) => make(s.WHATSAPP_TEMPLATE_AUTH, [code], code),
    productApproved: (productName) => make(s.WHATSAPP_TEMPLATE_PRODUCT_APPROVED, [templateParam(productName, 60)]),
    productRejected: (productName, reason) =>
      make(s.WHATSAPP_TEMPLATE_PRODUCT_REJECTED, [templateParam(productName, 60), templateParam(reason)]),
    pricingApproved: (productName) => make(s.WHATSAPP_TEMPLATE_PRICING_APPROVED, [templateParam(productName, 60)]),
    pricingRejected: (productName, reason) =>
      make(s.WHATSAPP_TEMPLATE_PRICING_REJECTED, [templateParam(productName, 60), templateParam(reason)]),
    orderStatus: (orderRef, status) =>
      make(s.WHATSAPP_TEMPLATE_ORDER_STATUS, [templateParam(orderRef, 20), templateParam(status, 40)]),
    payoutPaid: (amount) => make(s.WHATSAPP_TEMPLATE_PAYOUT_PAID, [templateParam(amount, 20)]),
    sellerApproved: () => make(s.WHATSAPP_TEMPLATE_SELLER_APPROVED, []),
    agentApproved: () => make(s.WHATSAPP_TEMPLATE_AGENT_APPROVED, []),
    newMessage: () => make(s.WHATSAPP_TEMPLATE_NEW_MESSAGE, []),
  };
}

/**
 * Sends the template when there is one and the provider can, otherwise (or when the template
 * fails, for example because it is not approved yet) the plain text. Throws only when the text
 * also fails, so callers see one error.
 */
export async function sendWithTemplateFallback(
  provider: WhatsAppProvider,
  to: string,
  template: WhatsAppTemplate | null,
  text: string,
): Promise<void> {
  if (template && provider.sendTemplate) {
    try {
      await provider.sendTemplate(to, template);
      return;
    } catch (err) {
      logger.warn({ err, template: template.name }, '[whatsapp] template send failed, falling back to plain text');
    }
  }
  await provider.sendText(to, text);
}
