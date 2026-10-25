import { createHmac, timingSafeEqual } from 'crypto';
import {
  DownloadedMedia,
  InboundMedia,
  InboundMessage,
  SendResult,
  StatusUpdate,
  TemplateStatusUpdate,
  WebhookRequest,
  WhatsAppProvider,
  WhatsAppSendError,
  WhatsAppTemplate,
  normalizeWhatsAppNumber,
} from './types';

/**
 * Meta's WhatsApp Cloud API, called directly (no reseller). Compared with Twilio there is no
 * per-message platform fee and incoming messages are free; the 24-hour window and the need for
 * approved templates for messages we start are the same.
 */

const MEDIA_PREFIX = 'meta-media:';
const MAX_TEXT_LENGTH = 4096;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Meta signs the exact request bytes with the app secret: `sha256=<hex HMAC>`. */
export function metaSignature(appSecret: string, rawBody: Buffer): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

export function isValidMetaSignature(appSecret: string, rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature) return false;
  const expected = Buffer.from(metaSignature(appSecret, rawBody));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The text a seller typed, or the label of the button they tapped. */
function bodyOf(message: Json): string {
  switch (message.type) {
    case 'text':
      return isObject(message.text) ? str(message.text.body) : '';
    case 'button':
      return isObject(message.button) ? str(message.button.text) : '';
    case 'interactive': {
      const interactive = isObject(message.interactive) ? message.interactive : {};
      const reply = isObject(interactive.button_reply) ? interactive.button_reply : isObject(interactive.list_reply) ? interactive.list_reply : {};
      return str(reply.title);
    }
    default: {
      // A caption travels with its photo or video.
      const media = isObject(message[str(message.type)]) ? (message[str(message.type)] as Json) : {};
      return str(media.caption);
    }
  }
}

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

function mediaOf(message: Json): InboundMedia[] {
  const type = str(message.type);
  if (!MEDIA_TYPES.includes(type)) return [];
  const media = isObject(message[type]) ? (message[type] as Json) : {};
  const id = str(media.id);
  if (!id) return [];
  // "audio/ogg; codecs=opus" becomes "audio/ogg".
  const contentType = str(media.mime_type).split(';')[0].trim().toLowerCase();
  return [{ url: `${MEDIA_PREFIX}${id}`, contentType }];
}

/**
 * Reads a Meta webhook body. Only messages sent to `phoneNumberId` are kept (when given); delivery
 * and read receipts carry no messages and yield nothing. Unsupported kinds (location, contacts)
 * come through with an empty body so the seller still gets a "did not understand" reply.
 */
export function parseMetaInbound(payload: unknown, phoneNumberId?: string): InboundMessage[] {
  if (!isObject(payload) || !Array.isArray(payload.entry)) return [];
  const result: InboundMessage[] = [];

  for (const entry of payload.entry) {
    if (!isObject(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isObject(change) || !isObject(change.value)) continue;
      const value = change.value;
      const metadata = isObject(value.metadata) ? value.metadata : {};
      if (phoneNumberId && str(metadata.phone_number_id) !== phoneNumberId) continue;
      if (!Array.isArray(value.messages)) continue;

      for (const raw of value.messages) {
        if (!isObject(raw)) continue;
        const id = str(raw.id);
        const from = normalizeWhatsAppNumber(str(raw.from));
        if (!id || !from) continue;
        result.push({ providerMessageId: id, from, body: bodyOf(raw).trim(), media: mediaOf(raw) });
      }
    }
  }
  return result;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Every webhook change that belongs to our number (or any number when `phoneNumberId` is not given). */
function* changesOf(payload: unknown, field: string, phoneNumberId?: string): Generator<Json> {
  if (!isObject(payload)) return;
  for (const entry of asArray(payload.entry)) {
    if (!isObject(entry)) continue;
    for (const change of asArray(entry.changes)) {
      if (!isObject(change) || !isObject(change.value)) continue;
      if (str(change.field) && str(change.field) !== field) continue;
      if (phoneNumberId && field === 'messages') {
        const metadata = isObject(change.value.metadata) ? change.value.metadata : {};
        if (str(metadata.phone_number_id) !== phoneNumberId) continue;
      }
      yield change.value;
    }
  }
}

/** Delivery receipts: `statuses[]` next to (or instead of) `messages[]` in a `messages` change. */
export function parseMetaStatuses(payload: unknown, phoneNumberId?: string): StatusUpdate[] {
  const result: StatusUpdate[] = [];
  for (const value of changesOf(payload, 'messages', phoneNumberId)) {
    for (const raw of asArray(value.statuses)) {
      if (!isObject(raw)) continue;
      const id = str(raw.id);
      const status = str(raw.status);
      if (!id || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue;
      const error = isObject(asArray(raw.errors)[0]) ? (asArray(raw.errors)[0] as Json) : undefined;
      result.push({
        providerMessageId: id,
        status: status as StatusUpdate['status'],
        ...(error && typeof error.code === 'number' ? { errorCode: error.code } : {}),
        ...(error ? { errorMessage: str(error.message) || str(error.title) || undefined } : {}),
      });
    }
  }
  return result;
}

/** Template approval events (`message_template_status_update`). */
export function parseMetaTemplateStatuses(payload: unknown): TemplateStatusUpdate[] {
  const result: TemplateStatusUpdate[] = [];
  for (const value of changesOf(payload, 'message_template_status_update')) {
    const id = value.message_template_id;
    const metaTemplateId = typeof id === 'number' ? String(id) : str(id);
    if (!metaTemplateId || !str(value.event)) continue;
    result.push({
      metaTemplateId,
      name: str(value.message_template_name),
      language: str(value.message_template_language),
      event: str(value.event).toUpperCase(),
      ...(str(value.reason) && str(value.reason) !== 'NONE' ? { reason: str(value.reason) } : {}),
    });
  }
  return result;
}

export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
}

/** Meta codes where waiting and retrying can work: rate limits and Meta-side outages. */
const TRANSIENT_CODES = new Set([130429, 131000, 131016, 80007, 4, 2]);

/** The status and Meta's error code and message, never including any token. */
async function errorParts(res: Response): Promise<{ text: string; code?: number }> {
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: number } };
    return {
      text: `${res.status} (code ${body.error?.code ?? 'unknown'}: ${body.error?.message ?? 'no message'})`,
      code: typeof body.error?.code === 'number' ? body.error.code : undefined,
    };
  } catch {
    return { text: String(res.status) };
  }
}

/** A readable reason from Meta's error body, never including any token. */
async function errorDetail(res: Response): Promise<string> {
  return (await errorParts(res)).text;
}

/** A refused send as a typed error, so callers can tell "try later" from "never". */
async function sendError(res: Response, what: string): Promise<WhatsAppSendError> {
  const { text, code } = await errorParts(res);
  const transient = res.status >= 500 || res.status === 429 || (code !== undefined && TRANSIENT_CODES.has(code));
  return new WhatsAppSendError(`Meta WhatsApp ${what} failed with ${text}`, res.status, code, transient);
}

/** The id Meta gives the accepted message: `messages[0].id`. */
async function messageIdOf(res: Response): Promise<SendResult> {
  try {
    const body = (await res.json()) as { messages?: { id?: string }[] };
    const id = body.messages?.[0]?.id;
    return id ? { messageId: id } : {};
  } catch {
    return {};
  }
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: MetaConfig) {}

  private get graph(): string {
    return `https://graph.facebook.com/${this.config.graphVersion}`;
  }

  private get auth(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.accessToken}` };
  }

  async sendText(to: string, body: string): Promise<void> {
    const res = await fetch(`${this.graph}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { ...this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body: body.slice(0, MAX_TEXT_LENGTH) },
      }),
    });
    if (!res.ok) throw await sendError(res, 'send');
  }

  /**
   * Template message. An authentication template with a copy-code button also needs the code
   * repeated as the button's parameter; other templates only need their body values.
   */
  async sendTemplate(to: string, template: WhatsAppTemplate): Promise<SendResult> {
    const components: unknown[] = [];
    if (template.body.length > 0) {
      components.push({ type: 'body', parameters: template.body.map((text) => ({ type: 'text', text })) });
    }
    if (template.copyCode) {
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: template.copyCode }] });
    }
    const res = await fetch(`${this.graph}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { ...this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/^\+/, ''),
        type: 'template',
        template: { name: template.name, language: { code: template.language }, components },
      }),
    });
    if (!res.ok) throw await sendError(res, 'template send');
    return messageIdOf(res);
  }

  verifyWebhook(req: WebhookRequest): boolean {
    return isValidMetaSignature(this.config.appSecret, req.rawBody, req.header('x-hub-signature-256'));
  }

  parseInbound(req: WebhookRequest): InboundMessage[] {
    if (!req.rawBody) return [];
    try {
      return parseMetaInbound(JSON.parse(req.rawBody.toString('utf8')), this.config.phoneNumberId);
    } catch {
      return [];
    }
  }

  parseStatuses(req: WebhookRequest): StatusUpdate[] {
    if (!req.rawBody) return [];
    try {
      return parseMetaStatuses(JSON.parse(req.rawBody.toString('utf8')), this.config.phoneNumberId);
    } catch {
      return [];
    }
  }

  parseTemplateStatuses(req: WebhookRequest): TemplateStatusUpdate[] {
    if (!req.rawBody) return [];
    try {
      return parseMetaTemplateStatuses(JSON.parse(req.rawBody.toString('utf8')));
    } catch {
      return [];
    }
  }

  /** Meta's one-time GET: echo `hub.challenge` only when the verify token is ours. */
  verifyChallenge(query: Record<string, string>): string | null {
    if (query['hub.mode'] !== 'subscribe') return null;
    if (!safeEqual(query['hub.verify_token'] ?? '', this.config.verifyToken)) return null;
    return query['hub.challenge'] ?? null;
  }

  /** Two steps: ask the Graph API where media `<id>` lives, then download it with our token. */
  async downloadMedia(url: string, maxBytes: number): Promise<DownloadedMedia> {
    if (!url.startsWith(MEDIA_PREFIX)) throw new Error('Not a Meta media reference');
    const id = url.slice(MEDIA_PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid Meta media id');

    const info = await fetch(`${this.graph}/${id}`, { headers: this.auth });
    if (!info.ok) throw new Error(`Meta media lookup failed with ${await errorDetail(info)}`);
    const meta = (await info.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url || new URL(meta.url).protocol !== 'https:') throw new Error('Meta returned no usable media URL');
    if (typeof meta.file_size === 'number' && meta.file_size > maxBytes) throw new Error('Media file is too large');

    const res = await fetch(meta.url, { headers: this.auth });
    if (!res.ok) throw new Error(`Meta media download failed with ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error('Media file is too large');
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('Media file is too large');
    return { buffer, contentType: (meta.mime_type ?? res.headers.get('content-type') ?? '').split(';')[0].trim() };
  }
}
