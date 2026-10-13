import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface WhatsAppProvider {
  /** `to` is an international number such as +919812345678. */
  sendText(to: string, body: string): Promise<void>;
}

/** Used until a WhatsApp Business provider is configured: logs instead of sending. */
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  async sendText(to: string, body: string): Promise<void> {
    logger.info({ to, body }, '[whatsapp:console] message not sent (no provider configured)');
  }
}

/**
 * Twilio's WhatsApp API. Note: messages a business starts outside a 24-hour customer window
 * must use a template approved by Meta; configure templates in Twilio before going live.
 */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async sendText(to: string, body: string): Promise<void> {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: `whatsapp:${this.from}`, To: `whatsapp:${to}`, Body: body }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Twilio WhatsApp send failed with ${res.status}`);
    }
  }
}

/** Keeps only digits and a leading +; returns null when it can't be an international number. */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return /^\+\d{8,15}$/.test(withPlus) ? withPlus : null;
}

export const whatsAppProvider: WhatsAppProvider =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM
    ? new TwilioWhatsAppProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_WHATSAPP_FROM)
    : new ConsoleWhatsAppProvider();
