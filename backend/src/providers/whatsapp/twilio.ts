import { createHmac, timingSafeEqual } from 'crypto';
import {
  DownloadedMedia,
  InboundMedia,
  InboundMessage,
  SendResult,
  WebhookRequest,
  WhatsAppProvider,
  WhatsAppTemplate,
  normalizeWhatsAppNumber,
} from './types';

/**
 * A readable reason from Twilio's error body (never any credential), e.g. "400 (code 21654: ContentSid
 * Required)". Without it a refused send is only a bare status number.
 */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: number; message?: string };
    return `${res.status} (code ${body.code ?? 'unknown'}: ${body.message ?? 'no message'})`;
  } catch {
    return String(res.status);
  }
}

/** Twilio webhook fields: From (whatsapp:+91...), Body, MessageSid, NumMedia, MediaUrl0.. */
export function parseTwilioInbound(params: Record<string, string>): InboundMessage | null {
  const providerMessageId = params.MessageSid || params.SmsMessageSid;
  const from = normalizeWhatsAppNumber((params.From ?? '').replace(/^whatsapp:/, ''));
  if (!providerMessageId || !from) return null;

  const count = Math.min(Number.parseInt(params.NumMedia ?? '0', 10) || 0, 10);
  const media: InboundMedia[] = [];
  for (let i = 0; i < count; i += 1) {
    const url = params[`MediaUrl${i}`];
    if (url) media.push({ url, contentType: params[`MediaContentType${i}`] ?? '' });
  }
  return { providerMessageId, from, body: (params.Body ?? '').trim(), media };
}

/** Twilio signs the full URL followed by every POST field (sorted by name) as key+value. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(data).digest('base64');
}

export function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
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
    if (!res.ok) throw new Error(`Twilio WhatsApp send failed with ${await errorDetail(res)}`);
  }

  /** Twilio sends templates through the Content API: the template is a Content SID with numbered variables. */
  async sendTemplate(to: string, template: WhatsAppTemplate): Promise<SendResult> {
    const variables: Record<string, string> = {};
    const values = template.copyCode && template.body.length === 0 ? [template.copyCode] : template.body;
    values.forEach((value, i) => {
      variables[String(i + 1)] = value;
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${this.from}`,
        To: `whatsapp:${to}`,
        ContentSid: template.name,
        ContentVariables: JSON.stringify(variables),
      }).toString(),
    });
    if (!res.ok) throw new Error(`Twilio WhatsApp template send failed with ${await errorDetail(res)}`);
    try {
      const sid = ((await res.json()) as { sid?: string }).sid;
      return sid ? { messageId: sid } : {};
    } catch {
      return {};
    }
  }

  verifyWebhook(req: WebhookRequest): boolean {
    return isValidTwilioSignature(this.authToken, req.url, req.form, req.header('x-twilio-signature'));
  }

  parseInbound(req: WebhookRequest): InboundMessage[] {
    const message = parseTwilioInbound(req.form);
    return message ? [message] : [];
  }

  async downloadMedia(url: string, maxBytes: number): Promise<DownloadedMedia> {
    // Only fetch from Twilio: the URL comes from a (signed) webhook, but never send our
    // credentials anywhere else.
    if (new URL(url).hostname !== 'api.twilio.com') {
      throw new Error('Refusing to download media from a non-Twilio host');
    }
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}` },
    });
    if (!res.ok) throw new Error(`Twilio media download failed with ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error('Media file is too large');
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('Media file is too large');
    return { buffer, contentType: res.headers.get('content-type') ?? '' };
  }
}
