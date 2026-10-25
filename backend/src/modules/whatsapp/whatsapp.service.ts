import { logger } from '../../config/logger';
import {
  DownloadedMedia,
  InboundMedia,
  InboundMessage,
  StatusUpdate,
  TemplateStatusUpdate,
  WebhookRequest,
  WhatsAppProvider,
  whatsAppProvider,
} from '../../providers/whatsapp';
import { ConversationHandler } from './whatsapp.conversation';
import { WhatsAppRepository } from './whatsapp.repository';
import {
  WHATSAPP_IMAGE_TYPES,
  WHATSAPP_MAX_IMAGE_BYTES,
  WHATSAPP_MAX_VIDEO_BYTES,
  WHATSAPP_VIDEO_TYPES,
  WhatsAppMessageType,
} from './whatsapp.types';

export function classifyMessage(message: InboundMessage): WhatsAppMessageType {
  const first = message.media[0]?.contentType ?? '';
  if (first.startsWith('image/')) return 'image';
  if (first.startsWith('video/')) return 'video';
  if (first.startsWith('audio/')) return 'audio';
  if (message.media.length > 0) return 'other';
  return 'text';
}

/** What the webhook hands to Bulk Messages: delivery receipts and Meta's template verdicts. */
export interface BulkHooks {
  recordStatuses(updates: StatusUpdate[]): Promise<void>;
  applyTemplateStatus(update: TemplateStatusUpdate): Promise<void>;
}

export class WhatsAppService {
  constructor(
    private readonly repo: WhatsAppRepository = new WhatsAppRepository(),
    private readonly provider: WhatsAppProvider = whatsAppProvider,
    private readonly conversation?: ConversationHandler,
    private readonly bulk?: BulkHooks,
  ) {}

  verifyRequest(req: WebhookRequest): boolean {
    return this.provider.verifyWebhook(req);
  }

  /** Answers the provider's one-time webhook check (Meta); null means refuse. */
  verifyChallenge(query: Record<string, string>): string | null {
    return this.provider.verifyChallenge?.(query) ?? null;
  }

  /**
   * Accepts one webhook delivery, which can carry several messages. One failing message never
   * blocks the others.
   */
  async handleInbound(req: WebhookRequest): Promise<void> {
    await this.handleReceipts(req);
    const messages = this.provider.parseInbound(req);
    if (messages.length === 0) {
      logger.info('[whatsapp] webhook carried no messages (receipt, other number or unusable)');
      return;
    }
    for (const message of messages) {
      try {
        await this.handleMessage(message);
      } catch (err) {
        logger.error({ err, id: message.providerMessageId }, '[whatsapp] could not handle a message');
      }
    }
  }

  /** Delivery receipts and template verdicts for admin Bulk Messages; a failure here never blocks messages. */
  private async handleReceipts(req: WebhookRequest): Promise<void> {
    if (!this.bulk) return;
    try {
      const statuses = this.provider.parseStatuses?.(req) ?? [];
      if (statuses.length > 0) await this.bulk.recordStatuses(statuses);
      for (const update of this.provider.parseTemplateStatuses?.(req) ?? []) {
        await this.bulk.applyTemplateStatus(update);
      }
    } catch (err) {
      logger.error({ err }, '[whatsapp] could not record delivery receipts');
    }
  }

  /**
   * Retries of a message already seen are dropped here, before anything costs money (no AI call,
   * no reply). New messages go to the conversation.
   */
  private async handleMessage(message: InboundMessage): Promise<void> {
    const isNew = await this.repo.recordIfNew({
      providerMessageId: message.providerMessageId,
      phone: message.from,
      type: classifyMessage(message),
      mediaCount: message.media.length,
    });
    if (!isNew) {
      logger.info({ id: message.providerMessageId }, '[whatsapp] duplicate delivery dropped');
      return;
    }

    logger.info({ from: message.from, type: classifyMessage(message) }, '[whatsapp] inbound message accepted');
    await this.conversation?.handle(message);
  }

  /** Downloads a media file from a webhook, accepting only listed image/video types within the size cap. */
  async fetchMedia(media: InboundMedia): Promise<DownloadedMedia & { kind: 'image' | 'video' }> {
    const type = media.contentType.toLowerCase();
    const isImage = (WHATSAPP_IMAGE_TYPES as readonly string[]).includes(type);
    const isVideo = (WHATSAPP_VIDEO_TYPES as readonly string[]).includes(type);
    if (!isImage && !isVideo) throw new Error(`Unsupported media type: ${media.contentType || 'unknown'}`);

    const file = await this.provider.downloadMedia(media.url, isImage ? WHATSAPP_MAX_IMAGE_BYTES : WHATSAPP_MAX_VIDEO_BYTES);
    return { ...file, contentType: type, kind: isImage ? 'image' : 'video' };
  }
}
