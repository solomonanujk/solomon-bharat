import { logger } from '../../config/logger';
import { InboundMessage, WhatsAppProvider } from '../../providers/whatsapp';
import { AppError } from '../../utils/errors';
import { Command, Language, detectLanguage, normalizeText, parseCommand, resolveTarget, Target } from './whatsapp.commands';
import { ListingFlowPort } from './whatsapp.listing.flow';
import { MAX_LISTED, ProductLine, messages } from './whatsapp.messages';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A number sending more than this many messages an hour gets no replies: each reply costs money. */
export const MAX_MESSAGES_PER_HOUR = 60;
/** Photos arrive as one webhook each, so answer a burst of media only once. */
const MEDIA_REPLY_WINDOW_MS = 10 * 60 * 1000;
const MAX_STOCK = 1_000_000;
/** How many of a seller's newest products "list" numbers and name matching can see. */
const LOOKUP_LIMIT = 50;

export interface SellerLookup {
  findSellerByWhatsAppNumber(phone: string): Promise<{ id: string } | null>;
}

export interface MessageLog {
  countSince(phone: string, since: Date, withMedia?: boolean): Promise<number>;
}

export interface ProductSummary {
  id: string;
  name: string;
  approvalStatus: ProductLine['status'];
  rejectionReason: string | null;
  declaredStock: number;
}

/** The slice of ProductsService the conversation needs, so tests can swap it out. */
export interface ProductsPort {
  listForSeller(
    sellerId: string,
    filter: Record<string, never>,
    pagination: { page: number; limit: number },
  ): Promise<{ data: ProductSummary[]; total: number }>;
  setStockForSeller(sellerId: string, productId: string, quantity: number): Promise<unknown>;
  resubmitProduct(sellerId: string, productId: string): Promise<unknown>;
}

/**
 * What the conversation needs from the admin Bulk Messages feature: a seller's answer to a broadcast
 * is saved for admin instead of being run through the listing bot, and STOP-style words switch
 * broadcasts off.
 */
export interface BulkPort {
  /** Saves a reply to a bulk message sent in the last 24 h; null when none was sent to this number. */
  recordReply(message: InboundMessage): Promise<{ firstReply: boolean } | null>;
  hasRecentBulkMessage(phone: string): Promise<boolean>;
  setOptOut(sellerId: string, optedOut: boolean): Promise<void>;
}

/** Commands that always keep their usual meaning, even right after a broadcast. */
const MANAGEMENT_COMMANDS = new Set<Command['kind']>([
  'help',
  'list',
  'add',
  'stock',
  'outOfStock',
  'resubmit',
  'stockUsage',
  'outOfStockUsage',
  'resubmitUsage',
]);

export interface ConversationHandler {
  handle(message: InboundMessage): Promise<void>;
}

/**
 * What a seller can do by WhatsApp today (no AI): help, list/status, stock, out of stock and
 * resubmit. Photo-based listing builds on the same entry point in the next phase.
 */
export class WhatsAppConversation implements ConversationHandler {
  constructor(
    private readonly sellers: SellerLookup,
    private readonly products: ProductsPort,
    private readonly log: MessageLog,
    private readonly provider: WhatsAppProvider,
    private readonly portalUrl: string,
    private readonly flow?: ListingFlowPort,
    private readonly bulk?: BulkPort,
  ) {}

  async handle(message: InboundMessage): Promise<void> {
    const lang = detectLanguage(message.body);
    const seller = await this.sellers.findSellerByWhatsAppNumber(message.from);

    if (!seller) {
      // Reply once a day to strangers: anything more is a free way to burn our message budget.
      if ((await this.log.countSince(message.from, new Date(Date.now() - DAY_MS))) <= 1) {
        await this.reply(message.from, messages.unlinked(lang, this.portalUrl));
      }
      return;
    }

    if ((await this.log.countSince(message.from, new Date(Date.now() - HOUR_MS))) > MAX_MESSAGES_PER_HOUR) {
      logger.warn({ from: message.from }, '[whatsapp] hourly message cap reached, not replying');
      return;
    }

    const command = message.body ? parseCommand(message.body) : ({ kind: 'unknown' } as Command);

    // Switching broadcasts off or on is unambiguous, so it works even in the middle of a listing.
    if (this.bulk && (command.kind === 'optOut' || command.kind === 'optIn')) {
      const optOut = command.kind === 'optOut';
      await this.bulk.setOptOut(seller.id, optOut);
      await this.reply(message.from, optOut ? messages.optedOut(lang) : messages.optedIn(lang));
      return;
    }

    const session = this.flow ? await this.flow.findSession(message.from) : null;

    // An answer to an admin broadcast ("Thanks", a tapped button) is saved for admin, never sent to the
    // listing bot or answered with "did not understand". An open listing, photos and real commands win.
    if (this.bulk && session === null && message.media.length === 0 && !MANAGEMENT_COMMANDS.has(command.kind)) {
      const asksToStop = command.kind === 'cancel' && normalizeText(message.body) === 'stop';
      if (asksToStop && (await this.bulk.hasRecentBulkMessage(message.from))) {
        await this.bulk.setOptOut(seller.id, true);
        await this.reply(message.from, messages.optedOut(lang));
        return;
      }
      const saved = await this.bulk.recordReply(message);
      if (saved) {
        if (saved.firstReply) await this.reply(message.from, messages.bulkReplyReceived(lang));
        return;
      }
    }

    if (this.flow) {
      // While a listing is open only help, list and cancel keep their usual meaning; everything
      // else the seller types is part of the product. Photos and "add" open a new listing.
      const inListing = session !== null && command.kind !== 'help' && command.kind !== 'list';
      if (inListing || (session === null && (message.media.length > 0 || command.kind === 'add'))) {
        try {
          await this.flow.handle({ sellerId: seller.id, message, command, lang, session });
        } catch (err) {
          logger.error({ err }, '[whatsapp] listing flow failed');
          await this.reply(message.from, messages.failed(lang, 'Something went wrong. Please try again.'));
        }
        return;
      }
    }

    if (message.media.length > 0 && command.kind === 'unknown') {
      const since = new Date(Date.now() - MEDIA_REPLY_WINDOW_MS);
      if ((await this.log.countSince(message.from, since, true)) <= 1) {
        await this.reply(message.from, messages.photoListingSoon(lang));
      }
      return;
    }

    try {
      await this.reply(message.from, await this.execute(seller.id, command, lang));
    } catch (err) {
      const reason = err instanceof AppError ? err.message : 'Something went wrong. Please try again.';
      if (!(err instanceof AppError)) logger.error({ err }, '[whatsapp] command failed');
      await this.reply(message.from, messages.failed(lang, reason));
    }
  }

  private async execute(sellerId: string, command: Command, lang: Language): Promise<string> {
    switch (command.kind) {
      case 'help':
        return messages.help(lang);
      case 'cancel':
        return messages.cancelled(lang);
      case 'stockUsage':
        return messages.stockUsage(lang);
      case 'outOfStockUsage':
        return messages.outOfStockUsage(lang);
      case 'resubmitUsage':
        return messages.resubmitUsage(lang);
      case 'list':
        return this.list(sellerId, lang);
      case 'stock':
        return this.setStock(sellerId, command.target, command.quantity, lang);
      case 'outOfStock':
        return this.setStock(sellerId, command.target, 0, lang);
      case 'resubmit':
        return this.resubmit(sellerId, command.target, lang);
      default:
        return messages.didNotUnderstand(lang);
    }
  }

  private fetchProducts(sellerId: string) {
    return this.products.listForSeller(sellerId, {}, { page: 1, limit: LOOKUP_LIMIT });
  }

  private async list(sellerId: string, lang: Language): Promise<string> {
    const { data, total } = await this.fetchProducts(sellerId);
    if (data.length === 0) return messages.noProducts(lang);
    const lines: ProductLine[] = data.slice(0, MAX_LISTED).map((p, i) => ({
      n: i + 1,
      name: p.name,
      status: p.approvalStatus,
      stock: p.declaredStock,
      rejectionReason: p.rejectionReason,
    }));
    return messages.list(lang, lines, total);
  }

  /** Looks the product up, answering "not found" / "which one?" itself when it can't pick one. */
  private async pick(sellerId: string, target: Target, lang: Language) {
    const { data } = await this.fetchProducts(sellerId);
    const { product, matches } = resolveTarget(target, data);
    if (product) return { product };
    return { reply: matches.length > 1 ? messages.ambiguous(lang, matches.map((m) => m.name)) : messages.notFound(lang) };
  }

  private async setStock(sellerId: string, target: Target, quantity: number, lang: Language): Promise<string> {
    if (quantity > MAX_STOCK) throw AppError.badRequest(`Stock can be at most ${MAX_STOCK}`);
    const picked = await this.pick(sellerId, target, lang);
    if (!picked.product) return picked.reply;
    await this.products.setStockForSeller(sellerId, picked.product.id, quantity);
    return quantity === 0 ? messages.outOfStock(lang, picked.product.name) : messages.stockUpdated(lang, picked.product.name, quantity);
  }

  private async resubmit(sellerId: string, target: Target, lang: Language): Promise<string> {
    const picked = await this.pick(sellerId, target, lang);
    if (!picked.product) return picked.reply;
    if (picked.product.approvalStatus !== 'REJECTED') return messages.notRejected(lang, picked.product.name);
    await this.products.resubmitProduct(sellerId, picked.product.id);
    return messages.resubmitted(lang, picked.product.name);
  }

  private async reply(to: string, body: string): Promise<void> {
    try {
      await this.provider.sendText(to, body);
    } catch (err) {
      logger.error({ err }, '[whatsapp] reply could not be sent');
    }
  }
}
