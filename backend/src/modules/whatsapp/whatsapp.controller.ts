import { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { WebhookRequest } from '../../providers/whatsapp';
import { WhatsAppService } from './whatsapp.service';
import { whatsAppService } from './whatsapp.wiring';

/** Keeps the string fields of a form body (Twilio sends flat key/value pairs). */
function toParams(body: unknown): Record<string, string> {
  const params: Record<string, string> = {};
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (typeof value === 'string') params[key] = value;
    }
  }
  return params;
}

/** Flat query strings; `hub.mode` may arrive nested as `{hub: {mode}}` depending on the parser. */
function toQuery(query: unknown): Record<string, string> {
  const flat: Record<string, string> = {};
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (typeof value === 'string') flat[key] = value;
      else if (value && typeof value === 'object') {
        for (const [sub, inner] of Object.entries(value as Record<string, unknown>)) {
          if (typeof inner === 'string') flat[`${key}.${sub}`] = inner;
        }
      }
    }
  }
  return flat;
}

/** The exact public URL the provider called: the configured base when set, else this request's own. */
function webhookUrl(req: Request): string {
  const path = req.originalUrl.split('?')[0];
  const base = env.WHATSAPP_WEBHOOK_BASE_URL.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
  return `${base}${path}`;
}

function toWebhookRequest(req: Request): WebhookRequest {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : undefined;
  return {
    url: webhookUrl(req),
    header: (name) => req.get(name) ?? undefined,
    rawBody,
    form: toParams(req.body),
    query: toQuery(req.query),
  };
}

export class WhatsAppController {
  constructor(private readonly service: WhatsAppService = whatsAppService) {}

  /**
   * Inbound webhook (Twilio form or Meta JSON). Answers straight away and does the work
   * afterwards: both providers retry when a reply takes too long, which a cold start would
   * otherwise cause.
   */
  webhook = async (req: Request, res: Response): Promise<void> => {
    const request = toWebhookRequest(req);
    if (!this.service.verifyRequest(request)) {
      logger.warn('[whatsapp] webhook rejected: bad signature');
      res.status(403).json({ success: false, data: null, message: 'Invalid signature' });
      return;
    }

    res.status(200).type('text/xml').send('<Response/>');
    this.service.handleInbound(request).catch((err) => logger.error({ err }, '[whatsapp] inbound handling failed'));
  };

  /** Meta's one-time check when the webhook is registered: echo the challenge if the token matches. */
  challenge = async (req: Request, res: Response): Promise<void> => {
    const challenge = this.service.verifyChallenge(toQuery(req.query));
    if (challenge === null) {
      logger.warn('[whatsapp] webhook verification refused');
      res.status(403).json({ success: false, data: null, message: 'Verification failed' });
      return;
    }
    res.status(200).type('text/plain').send(challenge);
  };
}

export const whatsAppController = new WhatsAppController();
