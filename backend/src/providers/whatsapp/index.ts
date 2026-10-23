import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MetaWhatsAppProvider, parseMetaInbound } from './meta';
import { TwilioWhatsAppProvider, parseTwilioInbound } from './twilio';
import { createTemplateCatalog } from './templates';
import { DownloadedMedia, InboundMessage, WebhookRequest, WhatsAppProvider, WhatsAppTemplate } from './types';

export * from './types';
export { MetaWhatsAppProvider, isValidMetaSignature, metaSignature, parseMetaInbound } from './meta';
export { TwilioWhatsAppProvider, isValidTwilioSignature, parseTwilioInbound, twilioSignature } from './twilio';
export { EMPTY_TEMPLATE_SETTINGS, createTemplateCatalog, sendWithTemplateFallback, templateParam } from './templates';
export type { TemplateCatalog, TemplateSettings } from './templates';

/** Used until a WhatsApp Business provider is configured: logs instead of sending. */
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  async sendText(to: string, body: string): Promise<void> {
    logger.info({ to, body }, '[whatsapp:console] message not sent (no provider configured)');
  }

  async sendTemplate(to: string, template: WhatsAppTemplate): Promise<void> {
    logger.info({ to, template }, '[whatsapp:console] template not sent (no provider configured)');
  }

  /** No secret to check against, so only local development (replaying payloads) may use it. */
  verifyWebhook(): boolean {
    return env.NODE_ENV !== 'production';
  }

  /** Accepts a replayed Meta JSON body or Twilio form fields. */
  parseInbound(req: WebhookRequest): InboundMessage[] {
    if (req.rawBody) {
      try {
        return parseMetaInbound(JSON.parse(req.rawBody.toString('utf8')));
      } catch {
        return [];
      }
    }
    const message = parseTwilioInbound(req.form);
    return message ? [message] : [];
  }

  async downloadMedia(): Promise<DownloadedMedia> {
    throw new Error('Media download needs a configured WhatsApp provider');
  }
}

export interface ProviderSettings {
  WHATSAPP_PROVIDER: 'auto' | 'twilio' | 'meta';
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_WHATSAPP_FROM: string;
  META_WHATSAPP_ACCESS_TOKEN: string;
  META_WHATSAPP_PHONE_NUMBER_ID: string;
  META_WHATSAPP_APP_SECRET: string;
  META_WHATSAPP_VERIFY_TOKEN: string;
  META_GRAPH_VERSION: string;
}

/**
 * Picks the provider. `auto` prefers Meta when all of its settings are present (it is the cheaper
 * one), then Twilio, then the console logger. An explicit choice with missing settings falls back
 * to the console logger instead of silently using the other provider.
 */
export function createWhatsAppProvider(s: ProviderSettings): { name: 'meta' | 'twilio' | 'console'; provider: WhatsAppProvider } {
  const metaReady = Boolean(
    s.META_WHATSAPP_ACCESS_TOKEN && s.META_WHATSAPP_PHONE_NUMBER_ID && s.META_WHATSAPP_APP_SECRET && s.META_WHATSAPP_VERIFY_TOKEN,
  );
  const twilioReady = Boolean(s.TWILIO_ACCOUNT_SID && s.TWILIO_AUTH_TOKEN && s.TWILIO_WHATSAPP_FROM);

  if ((s.WHATSAPP_PROVIDER === 'meta' || s.WHATSAPP_PROVIDER === 'auto') && metaReady) {
    return {
      name: 'meta',
      provider: new MetaWhatsAppProvider({
        accessToken: s.META_WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: s.META_WHATSAPP_PHONE_NUMBER_ID,
        appSecret: s.META_WHATSAPP_APP_SECRET,
        verifyToken: s.META_WHATSAPP_VERIFY_TOKEN,
        graphVersion: s.META_GRAPH_VERSION,
      }),
    };
  }
  if ((s.WHATSAPP_PROVIDER === 'twilio' || s.WHATSAPP_PROVIDER === 'auto') && twilioReady) {
    return {
      name: 'twilio',
      provider: new TwilioWhatsAppProvider(s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN, s.TWILIO_WHATSAPP_FROM),
    };
  }
  return { name: 'console', provider: new ConsoleWhatsAppProvider() };
}

const selected = createWhatsAppProvider(env);
if (env.WHATSAPP_PROVIDER !== 'auto' && selected.name === 'console') {
  logger.warn(`[whatsapp] WHATSAPP_PROVIDER=${env.WHATSAPP_PROVIDER} but its settings are incomplete: messages are only logged`);
}
logger.info(`[whatsapp] provider: ${selected.name}`);

export const whatsAppProviderName = selected.name;
export const whatsAppProvider: WhatsAppProvider = selected.provider;

/** The templates set up through `WHATSAPP_TEMPLATE_*`; each is null until its setting is filled. */
export const whatsAppTemplates = createTemplateCatalog(env);
