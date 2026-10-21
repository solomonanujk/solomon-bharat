import type { Prisma, WhatsAppSession } from '@prisma/client';
import { logger } from '../../config/logger';
import { InboundMedia, InboundMessage } from '../../providers/whatsapp';
import { AppError } from '../../utils/errors';
import { ExtractInput, ExtractionError, ExtractPatch, ExtractResult, ListingExtractor } from './whatsapp.ai';
import { chooseOption, resolveCategory } from './whatsapp.category';
import { Command, Language } from './whatsapp.commands';
import {
  CategoryOption,
  FieldKey,
  ListingDraft,
  MAX_PHOTOS,
  MAX_VIDEOS,
  mergeDraft,
  missingFields,
  toCreateInput,
} from './whatsapp.listing';
import { listingMessages } from './whatsapp.listing.messages';
import { messages } from './whatsapp.messages';
import type { SessionUpdate } from './whatsapp.session.repository';

/**
 * A seller building one product in chat. Cost rules (owner decision: keep API cost minimal):
 * photos are stored, never sent to the AI; texts are buffered and read in ONE cheap call;
 * all missing fields are asked in a single message; at most a few AI calls per listing and a
 * daily cap per seller; simple numeric answers skip the AI entirely.
 */

export interface FlowConfig {
  aiEnabled: boolean;
  /** Most AI calls one seller may trigger per day. */
  dailyCap: number;
  /** Most AI calls for one listing before the seller is sent to the website. */
  maxAiCallsPerSession: number;
  /** Wait this long after the last message before reading a batch of texts. */
  debounceMs: number;
  /** Pause before the one retry when the AI service itself fails (busy or unreachable). */
  retryDelayMs: number;
}

/** `add` restarts a listing that has been idle this long even while it is still collecting. */
const ADD_RESTART_IDLE_MS = 10 * 60 * 1000;
/** Photos arriving after this much silence are a new product, not part of the open listing. */
const STALE_LISTING_MS = 2 * 60 * 60 * 1000;
/** Photos joining an unfinished listing get a notice when the last message was this long ago. */
const JOIN_NOTICE_IDLE_MS = 60 * 1000;

export const DEFAULT_FLOW_CONFIG: Omit<FlowConfig, 'aiEnabled' | 'dailyCap'> = {
  maxAiCallsPerSession: 4,
  debounceMs: 25_000,
  retryDelayMs: 1_500,
};

export interface SessionStore {
  findActive(phone: string): Promise<WhatsAppSession | null>;
  start(sellerId: string, phone: string, language: string): Promise<{ session: WhatsAppSession; created: boolean }>;
  appendText(phone: string, text: string): Promise<WhatsAppSession>;
  appendImage(phone: string, url: string): Promise<WhatsAppSession>;
  appendVideo(phone: string, url: string): Promise<WhatsAppSession>;
  update(phone: string, data: SessionUpdate): Promise<WhatsAppSession>;
  delete(phone: string): Promise<void>;
  callsOn(sellerId: string, day: string): Promise<number>;
  recordCall(sellerId: string, day: string, inputTokens: number, outputTokens: number): Promise<unknown>;
}

export interface MediaFetcher {
  fetch(media: InboundMedia): Promise<{ buffer: Buffer; contentType: string; kind: 'image' | 'video' }>;
}

export interface FileStore {
  uploadImage(buffer: Buffer, filename: string, folder: string): Promise<{ url: string }>;
  uploadVideo(buffer: Buffer, filename: string, folder: string): Promise<{ url: string }>;
}

export interface CategoryLeaves {
  leaves(): Promise<CategoryOption[]>;
}

export interface ProductCreator {
  createFromWhatsApp(
    sellerId: string,
    input: ReturnType<typeof toCreateInput>,
    imageUrls: string[],
    videoUrls: string[],
  ): Promise<{ name: string }>;
}

export interface FlowContext {
  sellerId: string;
  message: InboundMessage;
  command: Command;
  lang: Language;
  session: WhatsAppSession | null;
}

/** What the conversation needs from the listing flow. */
export interface ListingFlowPort {
  findSession(phone: string): Promise<WhatsAppSession | null>;
  handle(ctx: FlowContext): Promise<void>;
}

export type Reply = (to: string, body: string) => Promise<void>;
export type Scheduler = (key: string, fn: () => void, ms: number) => void;

const NUMBER_ANSWER = /^\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(rs\.?|₹|rupees?|inr|pcs?|pieces?|kgs?|kg|gms?|grams?|g)?\s*$/i;

/**
 * A lone number answering a lone question needs no AI: "450" for price, "20 pcs" for stock.
 * Weight only counts with a unit, since "5" alone could be kilos or grams.
 */
export function shortcutPatch(missing: string[], texts: string[]): ExtractPatch | null {
  if (missing.length !== 1 || texts.length !== 1) return null;
  const match = NUMBER_ANSWER.exec(texts[0]);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  const unit = (match[2] ?? '').toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (missing[0]) {
    case 'price':
      return /^(pcs?|pieces?|kgs?|kg|gms?|grams?|g)$/.test(unit) ? null : { price: value };
    case 'moq':
      return Number.isInteger(value) && !/^(rs\.?|₹|rupees?|inr|kgs?|kg|gms?|grams?|g)$/.test(unit) ? { moq: value } : null;
    case 'stock':
      return Number.isInteger(value) && !/^(rs\.?|₹|rupees?|inr|kgs?|kg|gms?|grams?|g)$/.test(unit) ? { stock: value } : null;
    case 'weight':
      if (/^(kgs?|kg)$/.test(unit)) return { weightKg: value };
      if (/^(gms?|grams?|g)$/.test(unit)) return { weightKg: value / 1000 };
      return null;
    default:
      return null;
  }
}

export class WhatsAppListingFlow implements ListingFlowPort {
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly store: SessionStore,
    private readonly extractor: ListingExtractor,
    private readonly media: MediaFetcher,
    private readonly files: FileStore,
    private readonly categories: CategoryLeaves,
    private readonly products: ProductCreator,
    private readonly reply: Reply,
    private readonly config: FlowConfig,
    private readonly schedule: Scheduler = (key, fn, ms) => {
      const old = this.timers.get(key);
      if (old) clearTimeout(old);
      const timer = setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, ms);
      timer.unref?.();
      this.timers.set(key, timer);
    },
  ) {}

  findSession(phone: string): Promise<WhatsAppSession | null> {
    return this.store.findActive(phone);
  }

  /** Forgets a pending "seller went quiet" timer, e.g. once `done` has already processed the listing. */
  private cancelTimer(phone: string): void {
    const timer = this.timers.get(phone);
    if (timer) clearTimeout(timer);
    this.timers.delete(phone);
  }

  /** One at a time per phone, so a photo and a text arriving together cannot trample each other. */
  private exclusive<T>(phone: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(phone) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => undefined);
    this.locks.set(phone, tail);
    void tail.then(() => {
      if (this.locks.get(phone) === tail) this.locks.delete(phone);
    });
    return run;
  }

  async handle(ctx: FlowContext): Promise<void> {
    const { message, sellerId } = ctx;
    const phone = message.from;

    // Voice notes cannot be read: say so, and do not open a listing for them.
    const audio = message.media.find((m) => m.contentType.toLowerCase().startsWith('audio/'));
    const mediaFiles = message.media.filter((m) => !m.contentType.toLowerCase().startsWith('audio/'));
    if (audio && mediaFiles.length === 0 && !message.body) {
      await this.reply(phone, listingMessages.audioNotSupported(ctx.lang));
      return;
    }

    // Downloading and storing photos is slow, so it happens before taking the per-phone lock.
    const stored = await this.storeMedia(sellerId, mediaFiles);

    await this.exclusive(phone, async () => {
      let session = await this.store.findActive(phone);
      // The number was linked to a different seller since this listing began: never carry it over.
      if (session && session.sellerId !== sellerId) {
        await this.store.delete(phone);
        session = null;
      }
      // A new product must not be mixed into an unfinished one. `add` starts over once the old
      // listing is past the collecting stage (or has sat for a while); photos arriving long after
      // the last message belong to a new product too.
      let discarded = false;
      if (session && this.startsOver(session, ctx.command.kind, mediaFiles.length > 0)) {
        await this.store.delete(phone);
        this.cancelTimer(phone);
        session = null;
        discarded = true;
      }
      if (!session && ctx.command.kind !== 'add' && mediaFiles.length === 0) return;
      // A listing is only worth opening if something usable came in.
      if (!session && stored.images.length + stored.videos.length === 0 && ctx.command.kind !== 'add') {
        if (stored.failed) await this.reply(phone, listingMessages.mediaFailed(ctx.lang));
        return;
      }

      let created = false;
      if (!session) {
        ({ session, created } = await this.store.start(sellerId, phone, ctx.lang));
      }
      const lang = this.languageOf(session, ctx.lang);
      if (discarded) await this.reply(phone, listingMessages.discardedOld(lang));
      await this.noticeIfJoiningOldListing(session, created, discarded, stored.images.length + stored.videos.length > 0, lang);
      if (created || (ctx.command.kind === 'add' && !created)) await this.reply(phone, listingMessages.started(lang));
      if (stored.failed) await this.reply(phone, listingMessages.mediaFailed(lang));

      for (const url of stored.images) if (session.imageUrls.length < MAX_PHOTOS) session = await this.store.appendImage(phone, url);
      for (const url of stored.videos) if (session.videoUrls.length < MAX_VIDEOS) session = await this.store.appendVideo(phone, url);

      await this.applyCommand(ctx, session, lang, stored.images.length > 0);
    });
  }

  /**
   * Photos sent while an unfinished listing is open (past collecting, not waiting for photos) are added to
   * it: say so once per burst, so a seller starting a different product knows to send `add`.
   */
  private async noticeIfJoiningOldListing(
    session: WhatsAppSession,
    created: boolean,
    discarded: boolean,
    hasMedia: boolean,
    lang: Language,
  ): Promise<void> {
    if (created || discarded || !hasMedia || session.state === 'COLLECTING' || session.missing.includes('photos')) return;
    const name = ((session.collected ?? {}) as ListingDraft).name;
    if (!name || Date.now() - session.lastMessageAt.getTime() < JOIN_NOTICE_IDLE_MS) return;
    await this.reply(session.phone, listingMessages.joinedOld(lang, name));
  }

  /**
   * True when the incoming message should replace the open listing instead of joining it:
   * `add` once the listing is past collecting or idle for 10 minutes (so "photos, then add" keeps
   * the photos), or photos after the listing sat idle for 2 hours.
   */
  private startsOver(session: WhatsAppSession, kind: Command['kind'], hasPhotos: boolean): boolean {
    const idle = Date.now() - session.lastMessageAt.getTime();
    const hasContent =
      session.texts.length > 0 || session.imageUrls.length > 0 || Object.keys((session.collected ?? {}) as object).length > 0;
    if (!hasContent) return false;
    if (kind === 'add') return session.state !== 'COLLECTING' || idle > ADD_RESTART_IDLE_MS;
    return hasPhotos && idle > STALE_LISTING_MS;
  }

  private languageOf(session: WhatsAppSession, incoming: Language): Language {
    if (incoming !== 'en' && session.language !== incoming) return incoming;
    return (session.language as Language) ?? incoming;
  }

  private async applyCommand(ctx: FlowContext, session: WhatsAppSession, lang: Language, gotPhotos: boolean): Promise<void> {
    const phone = ctx.message.from;
    const kind = ctx.command.kind;

    if (ctx.message.body && lang !== session.language) {
      session = await this.store.update(phone, { language: lang });
    }

    if (kind === 'cancel') {
      this.cancelTimer(phone);
      await this.store.delete(phone);
      await this.reply(phone, listingMessages.cancelled(lang));
      return;
    }
    if (kind === 'done') {
      // Processing now makes any pending "went quiet" timer redundant: it would only repeat the reply.
      this.cancelTimer(phone);
      await this.process(session, lang);
      return;
    }
    if (kind === 'confirm' && session.state === 'AWAITING_CONFIRM') {
      this.cancelTimer(phone);
      await this.submit(session, lang);
      return;
    }
    // "yes" while questions are open is not an answer: say what is expected instead of staying silent.
    if (kind === 'confirm' && session.state === 'AWAITING_ANSWERS') {
      await this.reply(phone, listingMessages.answerFirst(lang));
      return;
    }
    if (kind === 'add') return;

    // Anything else with words in it is part of the product description or an answer.
    const body = ctx.message.body.trim();
    const isFiller = kind === 'confirm';
    if (body && !isFiller) {
      await this.store.appendText(phone, body);
      this.schedule(phone, () => void this.processLater(phone), this.config.debounceMs);
    } else if (gotPhotos && session.state !== 'COLLECTING' && session.missing.includes('photos')) {
      this.schedule(phone, () => void this.processLater(phone), this.config.debounceMs);
    }
  }

  private async storeMedia(sellerId: string, files: InboundMedia[]): Promise<{ images: string[]; videos: string[]; failed: boolean }> {
    const images: string[] = [];
    const videos: string[] = [];
    let failed = false;
    const folder = `whatsapp/${sellerId}`;
    await Promise.all(
      files.map(async (file, i) => {
        try {
          const downloaded = await this.media.fetch(file);
          const name = `${Date.now()}-${i}`;
          if (downloaded.kind === 'image') {
            images.push((await this.files.uploadImage(downloaded.buffer, `${name}.jpg`, folder)).url);
          } else {
            videos.push((await this.files.uploadVideo(downloaded.buffer, `${name}.mp4`, folder)).url);
          }
        } catch (err) {
          logger.warn({ err }, '[whatsapp] could not store a media file');
          failed = true;
        }
      }),
    );
    return { images, videos, failed };
  }

  /** Runs when the seller has gone quiet for a while: reads whatever text arrived since. */
  private async processLater(phone: string): Promise<void> {
    try {
      await this.exclusive(phone, async () => {
        const session = await this.store.findActive(phone);
        if (!session) return;
        // A newer message re-armed the timer; let that one fire instead.
        if (Date.now() - session.lastMessageAt.getTime() < this.config.debounceMs - 1000) return;
        // Nothing new to read (`done` already handled it): answering again would repeat the last message.
        const waitingForPhotos = session.state !== 'COLLECTING' && session.missing.includes('photos');
        if (session.texts.length === 0 && !waitingForPhotos) return;
        await this.process(session, session.language as Language);
      });
    } catch (err) {
      logger.error({ err }, '[whatsapp] processing a listing failed');
    }
  }

  private async process(session: WhatsAppSession, lang: Language): Promise<void> {
    const phone = session.phone;
    const draft = (session.collected ?? {}) as ListingDraft;

    if (session.texts.length === 0 && session.imageUrls.length === 0 && Object.keys(draft).length === 0) {
      await this.reply(phone, listingMessages.nothingYet(lang));
      return;
    }

    let merged = draft;
    let aiCalls = session.aiCalls;

    if (session.texts.length > 0) {
      const shortcut = session.state === 'AWAITING_ANSWERS' ? shortcutPatch(session.missing, session.texts) : null;
      let patch: ExtractPatch;
      if (shortcut) {
        patch = shortcut;
      } else {
        const outcome = await this.callAi(session, draft, lang);
        if (outcome.stop) return;
        patch = outcome.patch;
        aiCalls += 1;
      }
      merged = await this.applyPatch(draft, patch);
    }

    let missing = missingFields(merged, session.imageUrls.length);
    if (missing.includes('category')) {
      const options = merged.categoryOptions ?? [];
      if (options.length > 0 && (merged.categoryAsks ?? 0) >= 1) {
        // Already asked once without a usable answer: take the closest match and flag it, instead of
        // leaving the seller stuck on one question. The summary says so and admin can still change it.
        merged = {
          ...merged,
          categoryId: options[0].id,
          categoryPath: options[0].path,
          categorySuggested: true,
          categoryOptions: undefined,
        };
        missing = missingFields(merged, session.imageUrls.length);
      } else {
        merged = { ...merged, categoryAsks: (merged.categoryAsks ?? 0) + 1 };
      }
    }
    const base: SessionUpdate = { texts: [], collected: merged as unknown as Prisma.InputJsonValue, aiCalls, missing };
    if (missing.length > 0) {
      await this.store.update(session.phone, { ...base, state: 'AWAITING_ANSWERS' });
      await this.reply(phone, listingMessages.questions(lang, missing as FieldKey[], merged.categoryOptions ?? []));
      return;
    }
    await this.store.update(session.phone, { ...base, state: 'AWAITING_CONFIRM' });
    await this.reply(phone, listingMessages.summary(lang, merged, session.imageUrls.length, session.videoUrls.length));
  }

  /** The gate in front of every AI call: switch, per-listing limit, daily cap, then the call. */
  private async callAi(
    session: WhatsAppSession,
    draft: ListingDraft,
    lang: Language,
  ): Promise<{ stop: true } | { stop: false; patch: ExtractPatch }> {
    const phone = session.phone;
    const giveUp = async (text: string): Promise<{ stop: true }> => {
      await this.store.delete(phone);
      await this.reply(phone, text);
      return { stop: true };
    };

    if (!this.config.aiEnabled) return giveUp(listingMessages.aiUnavailable(lang));
    if (session.aiCalls >= this.config.maxAiCallsPerSession) return giveUp(listingMessages.tooManyRounds(lang));
    const day = new Date().toISOString().slice(0, 10);
    if ((await this.store.callsOn(session.sellerId, day)) >= this.config.dailyCap) return giveUp(listingMessages.aiLimit(lang));

    const input = {
      texts: session.texts,
      known: draft,
      asked: session.missing as FieldKey[],
      categoryOptions: draft.categoryOptions,
    };
    try {
      const result = await this.extractWithRetry(input);
      await this.store.recordCall(session.sellerId, day, result.inputTokens, result.outputTokens);
      return { stop: false, patch: result.patch };
    } catch (err) {
      if (err instanceof ExtractionError) {
        // The model answered but not in a usable form: count the call, drop the text so the seller can
        // write it again, and keep the listing.
        await this.store.recordCall(session.sellerId, day, err.usage.inputTokens, err.usage.outputTokens);
        await this.store.update(phone, { texts: [], aiCalls: session.aiCalls + 1 });
        await this.reply(phone, listingMessages.extractFailed(lang));
      } else {
        // The AI service itself is busy or unreachable (retried once already). Nothing was read, so keep
        // the seller's text and let `done` try again; it costs them no retyping and no AI call.
        logger.error({ err }, '[whatsapp] AI extraction failed');
        await this.reply(phone, listingMessages.serviceBusy(lang));
      }
      return { stop: true };
    }
  }

  /** One retry after a short pause when the AI service fails; a malformed answer is not retried. */
  private async extractWithRetry(input: ExtractInput): Promise<ExtractResult> {
    try {
      return await this.extractor.extract(input);
    } catch (err) {
      // A quota error (429) will not clear in a second, so only other failures are retried.
      if (err instanceof ExtractionError || (err as { status?: unknown })?.status === 429) throw err;
      logger.warn({ err }, '[whatsapp] AI service failed, retrying once');
      await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs));
      return this.extractor.extract(input);
    }
  }

  /** Merges the AI's fields, then settles the category (the one step that needs the real tree). */
  private async applyPatch(base: ListingDraft, patch: ExtractPatch): Promise<ListingDraft> {
    const { categoryChoice, ...fields } = patch;
    let draft = base;
    if (fields.categoryText && fields.categoryText !== base.categoryText) {
      draft = { ...base };
      delete draft.categoryId;
      delete draft.categoryPath;
      delete draft.categorySuggested;
    }
    draft = mergeDraft(draft, fields);

    if (draft.categoryId) return draft;

    const chosen = chooseOption(categoryChoice, base.categoryOptions ?? []);
    if (chosen) {
      return { ...draft, categoryId: chosen.id, categoryPath: chosen.path, categoryOptions: undefined, categorySuggested: undefined };
    }

    const leaves = await this.categories.leaves();
    const { match, options } = resolveCategory(draft.categoryText ?? '', draft.name ?? '', leaves);
    if (match) {
      return { ...draft, categoryId: match.id, categoryPath: match.path, categoryOptions: undefined, categorySuggested: undefined };
    }
    return { ...draft, categoryOptions: options };
  }

  private async submit(session: WhatsAppSession, lang: Language): Promise<void> {
    const phone = session.phone;
    const draft = (session.collected ?? {}) as ListingDraft;
    if (missingFields(draft, session.imageUrls.length).length > 0) {
      await this.process(session, lang);
      return;
    }
    try {
      const product = await this.products.createFromWhatsApp(
        session.sellerId,
        toCreateInput(draft),
        session.imageUrls,
        session.videoUrls,
      );
      await this.store.delete(phone);
      await this.reply(phone, listingMessages.submitted(lang, product.name));
    } catch (err) {
      const reason = err instanceof AppError ? err.message : 'Something went wrong. Please try again.';
      if (!(err instanceof AppError)) logger.error({ err }, '[whatsapp] submitting a listing failed');
      await this.reply(phone, messages.failed(lang, reason));
    }
  }
}
