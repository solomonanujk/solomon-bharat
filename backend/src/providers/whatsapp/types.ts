/** Provider-neutral shapes shared by the Twilio and Meta WhatsApp providers. */

export interface InboundMedia {
  /** Where the provider serves the file. For Meta this is `meta-media:<id>`, resolved on download. */
  url: string;
  contentType: string;
}

/** One message from a seller, in provider-neutral form. */
export interface InboundMessage {
  providerMessageId: string;
  /** Normalised sender number (+919812345678). */
  from: string;
  body: string;
  media: InboundMedia[];
}

export interface DownloadedMedia {
  buffer: Buffer;
  contentType: string;
}

/** What a provider needs to check and read one webhook call. */
export interface WebhookRequest {
  /** The exact public URL that was called (Twilio signs it). */
  url: string;
  /** Reads a request header, case-insensitively. */
  header(name: string): string | undefined;
  /** The untouched request bytes when the body was JSON (Meta signs them). */
  rawBody?: Buffer;
  /** Flat form fields when the body was form-encoded (Twilio). */
  form: Record<string, string>;
  query: Record<string, string>;
}

/**
 * A pre-approved message a business may send outside the 24-hour window. `name` is the
 * provider's own identifier: the template name on Meta, the Content SID (HX...) on Twilio.
 */
export interface WhatsAppTemplate {
  name: string;
  /** Meta language code such as `en`; Twilio ignores it (the language is part of the Content SID). */
  language: string;
  /** Values for {{1}}, {{2}}, ... in the template body. */
  body: string[];
  /** One-time code for an authentication template's copy-code button (Meta). */
  copyCode?: string;
}

/** What a send returns: the provider's id for the message, used to match delivery receipts. */
export interface SendResult {
  messageId?: string;
}

/**
 * A refused send. `code` is the provider's own error code (Meta 131049, 130429, 132001 ...).
 * `transient` means trying again later can work (rate limit, provider outage); otherwise it never will.
 */
export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly transient = false,
  ) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

/** A delivery receipt for a message we sent. */
export interface StatusUpdate {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorCode?: number;
  errorMessage?: string;
}

/** Meta's verdict on a template we submitted (the `message_template_status_update` event). */
export interface TemplateStatusUpdate {
  metaTemplateId: string;
  name: string;
  language: string;
  event: string;
  reason?: string;
}

export interface WhatsAppProvider {
  /** `to` is an international number such as +919812345678. */
  sendText(to: string, body: string): Promise<void>;
  /** Sends an approved template; works outside the 24-hour window. Absent on the console logger. */
  sendTemplate?(to: string, template: WhatsAppTemplate): Promise<SendResult | void>;
  /** True when the webhook request really came from the provider. */
  verifyWebhook(req: WebhookRequest): boolean;
  /** The messages in one webhook call (Meta can batch several; status updates give none). */
  parseInbound(req: WebhookRequest): InboundMessage[];
  /** Delivery receipts (sent, delivered, read, failed) in one webhook call (Meta). */
  parseStatuses?(req: WebhookRequest): StatusUpdate[];
  /** Template approval events in one webhook call (Meta). */
  parseTemplateStatuses?(req: WebhookRequest): TemplateStatusUpdate[];
  /** Fetches a media file from a webhook media reference, rejecting anything over `maxBytes`. */
  downloadMedia(url: string, maxBytes: number): Promise<DownloadedMedia>;
  /** Answers the provider's one-time "is this really your webhook?" GET, or null to refuse (Meta only). */
  verifyChallenge?(query: Record<string, string>): string | null;
}

/** Keeps only digits and a leading +; returns null when it can't be an international number. */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return /^\+\d{8,15}$/.test(withPlus) ? withPlus : null;
}
