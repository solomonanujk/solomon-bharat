import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';
import { BrandStatus, GuideKnowledgeKind, GuideKnowledgeStatus, Prisma, PrismaClient, ProductApprovalStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { findWebPhotos, GuideWebPhoto } from './guide.images';
import { readSpreadsheet } from '../product-import/parsers/spreadsheet';
import {
  ChatTurn,
  extractTextFromImage,
  extractTextFromPdf,
  guideReply,
  setAdminAnthropicKey,
  setAdminGeminiKey,
  verifyAnthropicKey,
  setAdminOpenRouterKey,
  suggestUploads,
  summarizeKnowledge,
  verifyGeminiKey,
  verifyOpenRouterKey,
} from './guide.ai';

/** Longest single chat, in visitor messages, before the guide asks them to talk to the team. */
export const MAX_VISITOR_MESSAGES = 60;
/** Characters of knowledge sent with each answer (roughly 250k tokens). */
const KNOWLEDGE_BUDGET_CHARS = 900_000;
const SETTINGS_KEY = 'guide_settings';
const SUGGESTIONS_KEY = 'guide_upload_suggestions';
export type AiProvider = 'gemini' | 'openrouter' | 'anthropic';
const AI_KEY_SETTINGS: Record<AiProvider, string> = {
  gemini: 'guide_gemini_key',
  openrouter: 'guide_openrouter_key',
  anthropic: 'guide_anthropic_key',
};
interface KeyStatus {
  source: 'server' | 'admin' | 'none';
  last4: string | null;
}

// The admin-entered Gemini key is stored encrypted (AES-256-GCM, key derived from JWT_SECRET).
const cipherKey = (): Buffer => createHash('sha256').update(`${env.JWT_SECRET}:guide-ai-key`).digest();
function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}
function decrypt(stored: string): string {
  try {
    const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = createDecipheriv('aes-256-gcm', cipherKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export interface GuideSettings {
  allowWebSearch: boolean;
}
interface StoredTurn extends ChatTurn {
  at: string;
  /** Suggested next replies, shown as tappable buttons under an answer. */
  followUps?: string[];
  /** The visitor showed buying intent: show the WhatsApp button. */
  whatsapp?: boolean;
  /** Catalogue products shown as picture cards under the message. */
  products?: GuideProductCard[];
  /** Example photos from the open web (with credit) for product ideas. */
  photos?: GuideWebPhoto[];
  /** Recommended products, each with picture, story, fit and cost breakdown. */
  picks?: GuidePick[];
  /** Text the model wrote after the picks ("how to sell it"), shown under the cards. */
  note?: string;
}

/** One recommended product as the visitor sees it: a catalogue product or an idea shown with a web photo. */
export interface GuidePick {
  key: string;
  source: 'catalogue' | 'idea';
  name: string;
  image: string | null;
  link: string | null;
  credit?: string;
  category?: string;
  origin?: string;
  moq?: number;
  story: string;
  why: string;
  cost?: string;
  shipping?: string;
  duty?: string;
  landed?: string;
  sell?: string;
}

export interface GuideSavedItem {
  key: string;
  name: string;
  image: string | null;
  link: string | null;
  liked: boolean;
  saved: boolean;
}

interface CatalogueEntry extends GuideProductCard {
  story: string;
  origin: string | null;
  moq: number;
  fromInr: number | null;
}

/** A <<PICK>> line's JSON, as written by the model. */
interface RawPick {
  code?: string;
  name?: string;
  photo?: string;
  story?: string;
  why?: string;
  cost?: string;
  shipping?: string;
  duty?: string;
  landed?: string;
  sell?: string;
}

export interface GuideProductCard {
  slug: string;
  name: string;
  image: string | null;
  category: string;
}

/** Splits the hidden <<FOLLOWUPS>> / <<WHATSAPP>> lines off a model reply. */
export function parseGuideReply(raw: string): { content: string; note: string; followUps: string[]; whatsapp: boolean; productSlugs: string[]; imageQueries: string[]; picks: RawPick[] } {
  let followUps: string[] = [];
  let whatsapp = false;
  let productSlugs: string[] = [];
  let imageQueries: string[] = [];
  const picks: RawPick[] = [];
  const kept: string[] = [];
  const after: string[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim().replace(/^[*_`]+|[*_`]+$/g, '');
    if (/^<<\s*FOLLOW-?UPS\s*>>/i.test(t)) {
      followUps = t
        .replace(/^<<\s*FOLLOW-?UPS\s*>>:?/i, '')
        .split('|')
        .map((f) => f.replace(/[*_`"]/g, '').trim().replace(/^[-•\s]+/, ''))
        .filter((f) => f && f.length <= 90)
        .slice(0, 3);
    } else if (/^<<\s*PRODUCTS\s*>>/i.test(t)) {
      productSlugs = t
        .replace(/^<<\s*PRODUCTS\s*>>:?/i, '')
        .split(/[|,]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 4);
    } else if (/^<<\s*PICK\s*>>/i.test(line.trim())) {
      const json = line.trim().replace(/^<<\s*PICK\s*>>:?/i, '').trim();
      try {
        const v = JSON.parse(json) as RawPick;
        if (v && typeof v === 'object' && (v.code || v.name)) picks.push(v);
        // Anything written after the first pick is the "how to sell it" note shown under the cards.
      } catch {
        // A malformed pick is skipped rather than shown as text.
      }
    } else if (/^<<\s*IMAGES\s*>>/i.test(t)) {
      imageQueries = t
        .replace(/^<<\s*IMAGES\s*>>:?/i, '')
        .split('|')
        .map((q) => q.replace(/["*_`]/g, '').trim())
        .filter(Boolean)
        .slice(0, 4);
    } else if (/^<<\s*WHATSAPP\s*>>/i.test(t)) whatsapp = true;
    else if (/^\s*([-*_]\s*){3,}$/.test(line)) continue;
    else (picks.length ? after : kept).push(line);
  }
  // Plain text only: drop markdown emphasis and heading marks that make replies look machine-made.
  const plain = (lines: string[]) =>
    lines
      .join('\n')
      .replace(/\*+/g, '')
      .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,!?]|$)/g, '$1$2')
      .replace(/^#+\s*/gm, '')
      .replace(/`/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  return { content: plain(kept), note: plain(after), followUps, whatsapp, productSlugs, imageQueries, picks: picks.slice(0, 4) };
}

type IncomingFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export class GuideService {
  constructor(private readonly db: PrismaClient = prisma) {}

  // ─── AI keys (admin-entered OpenRouter / Gemini keys) ───────────────────────

  private keyLoadedAt = 0;

  private async readKey(provider: AiProvider): Promise<string> {
    const row = await this.db.platformSetting.findUnique({ where: { key: AI_KEY_SETTINGS[provider] } });
    const stored = (row?.value as { encrypted?: string } | null)?.encrypted;
    return stored ? decrypt(stored) : '';
  }

  /** Loads the saved keys into the AI module; re-read at most once a minute. */
  async loadAiKey(force = false): Promise<void> {
    if (!force && Date.now() - this.keyLoadedAt < 60_000) return;
    const [gemini, openrouter, anthropic] = await Promise.all([this.readKey('gemini'), this.readKey('openrouter'), this.readKey('anthropic')]);
    setAdminGeminiKey(gemini);
    setAdminOpenRouterKey(openrouter);
    setAdminAnthropicKey(anthropic);
    this.keyLoadedAt = Date.now();
  }

  async getAiKeyStatus(): Promise<{ active: 'openrouter' | 'gemini' | 'claude' | 'none'; openrouter: KeyStatus; gemini: KeyStatus; anthropic: KeyStatus }> {
    const status = async (provider: AiProvider, serverKey: string): Promise<KeyStatus> => {
      const key = await this.readKey(provider);
      if (key) return { source: 'admin', last4: key.slice(-4) };
      if (serverKey) return { source: 'server', last4: serverKey.slice(-4) };
      return { source: 'none', last4: null };
    };
    const [openrouter, gemini, anthropic] = await Promise.all([
      status('openrouter', env.OPENROUTER_API_KEY),
      status('gemini', env.GEMINI_API_KEY),
      status('anthropic', env.ANTHROPIC_API_KEY),
    ]);
    const active =
      anthropic.source !== 'none' ? 'claude' : openrouter.source !== 'none' ? 'openrouter' : gemini.source !== 'none' ? 'gemini' : 'none';
    return { active, openrouter, gemini, anthropic };
  }

  async saveAiKey(adminId: string, key: string, provider: AiProvider = 'gemini') {
    const clean = key.trim();
    const verify = { openrouter: verifyOpenRouterKey, gemini: verifyGeminiKey, anthropic: verifyAnthropicKey }[provider];
    if (!(await verify(clean))) {
      throw AppError.badRequest(
        {
          openrouter: 'OpenRouter did not accept this key. Copy it again from openrouter.ai → Keys.',
          gemini: 'Google did not accept this key. Copy it again from Google AI Studio and check it has the Gemini API enabled.',
          anthropic: 'Anthropic did not accept this key. Copy it again from console.anthropic.com → API keys, and check the account has credit.',
        }[provider],
      );
    }
    const settingKey = AI_KEY_SETTINGS[provider];
    const value = { encrypted: encrypt(clean) };
    await this.db.platformSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value }, update: { value } });
    await this.loadAiKey(true);
    await writeAuditLog(adminId, 'GUIDE_AI_KEY_SAVED', 'PlatformSetting', settingKey, { provider, last4: clean.slice(-4) });
    return this.getAiKeyStatus();
  }

  async removeAiKey(adminId: string, provider: AiProvider = 'gemini') {
    const settingKey = AI_KEY_SETTINGS[provider];
    await this.db.platformSetting.deleteMany({ where: { key: settingKey } });
    await this.loadAiKey(true);
    await writeAuditLog(adminId, 'GUIDE_AI_KEY_REMOVED', 'PlatformSetting', settingKey, { provider });
    return this.getAiKeyStatus();
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<GuideSettings> {
    const row = await this.db.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const value = (row?.value ?? {}) as Partial<GuideSettings>;
    // Web search is on unless the admin turns it off.
    return { allowWebSearch: value.allowWebSearch !== false };
  }

  async updateSettings(adminId: string, input: GuideSettings): Promise<GuideSettings> {
    const value = { allowWebSearch: input.allowWebSearch };
    await this.db.platformSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
    await writeAuditLog(adminId, 'GUIDE_SETTINGS_UPDATED', 'PlatformSetting', SETTINGS_KEY, value);
    return value;
  }

  // ─── Knowledge ─────────────────────────────────────────────────────────────

  async listKnowledge() {
    const rows = await this.db.guideKnowledge.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, kind: true, status: true, error: true, summary: true,
        fileUrl: true, fileName: true, sizeBytes: true, createdAt: true, updatedAt: true, content: true,
      },
    });
    const staleBefore = Date.now() - 20 * 60 * 1000;
    return rows.map(({ content, ...r }) => {
      // A job lost to a server restart never finishes; show it as failed so it can be re-uploaded.
      const interrupted = r.status === GuideKnowledgeStatus.PROCESSING && r.updatedAt.getTime() < staleBefore;
      return {
        ...r,
        status: interrupted ? GuideKnowledgeStatus.FAILED : r.status,
        error: interrupted ? 'Reading was interrupted. Remove it and upload the file again.' : r.error,
        characters: content.length,
      };
    });
  }

  /** Full text of one item, for "See what it learned". */
  async getKnowledgeItem(id: string) {
    const row = await this.db.guideKnowledge.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('Item not found');
    return row;
  }

  async addText(adminId: string, title: string, text: string) {
    const row = await this.db.guideKnowledge.create({
      data: { title: title.trim(), kind: GuideKnowledgeKind.TEXT, content: text.trim(), createdById: adminId },
    });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_ADDED', 'GuideKnowledge', row.id, { title: row.title, kind: row.kind });
    this.enqueueSummary(() => this.summarize(row.id, row.title, row.content));
    return row;
  }

  /** Files are read in the background one at a time, so uploads return at once and big
   *  files never time out the request or exhaust memory by running in parallel. */
  private queue: Promise<void> = Promise.resolve();
  private enqueue(job: () => Promise<void>): void {
    this.queue = this.queue.then(job).catch((err) => logger.error({ err }, 'Guide background job failed'));
  }
  /** Summaries (slow AI calls) run on their own line so they never hold up reading the next file. */
  private summaryQueue: Promise<void> = Promise.resolve();
  private enqueueSummary(job: () => Promise<void>): void {
    this.summaryQueue = this.summaryQueue.then(job).catch((err) => logger.error({ err }, 'Guide summary job failed'));
  }

  private kindOf(file: IncomingFile): GuideKnowledgeKind {
    const lower = file.originalname.toLowerCase();
    if (file.mimetype === 'application/pdf' || lower.endsWith('.pdf')) return GuideKnowledgeKind.PDF;
    if (IMAGE_TYPES.has(file.mimetype)) return GuideKnowledgeKind.IMAGE;
    if (lower.endsWith('.xlsx') || lower.endsWith('.csv')) return GuideKnowledgeKind.SPREADSHEET;
    if (lower.endsWith('.txt') || lower.endsWith('.md') || file.mimetype.startsWith('text/')) return GuideKnowledgeKind.TEXT;
    throw AppError.badRequest('Upload a PDF, an image (PNG, JPG, WebP), a spreadsheet (.xlsx, .csv) or a text file. For Word files, save as PDF first.');
  }

  async addFile(adminId: string, file: IncomingFile, title?: string) {
    const kind = this.kindOf(file);
    const name = file.originalname;
    const row = await this.db.guideKnowledge.create({
      data: {
        title: (title?.trim() || name.replace(/\.[^.]+$/, '')).slice(0, 200),
        kind,
        content: '',
        status: GuideKnowledgeStatus.PROCESSING,
        fileName: name,
        sizeBytes: file.size,
        createdById: adminId,
      },
    });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_ADDED', 'GuideKnowledge', row.id, { title: row.title, kind });
    const buffer = file.buffer;
    const mimetype = file.mimetype;
    this.enqueue(() => this.readFile(row.id, row.title, kind, name, mimetype, buffer));
    return row;
  }

  private async readFile(id: string, title: string, kind: GuideKnowledgeKind, name: string, mimetype: string, buffer: Buffer) {
    try {
      // Skip files the admin removed while they were waiting in line.
      if (!(await this.db.guideKnowledge.findUnique({ where: { id }, select: { id: true } }))) return;
      await this.loadAiKey();
      let content: string;
      if (kind === GuideKnowledgeKind.PDF) content = await extractTextFromPdf(buffer);
      else if (kind === GuideKnowledgeKind.IMAGE) content = await extractTextFromImage(buffer, mimetype as 'image/png');
      else if (kind === GuideKnowledgeKind.SPREADSHEET) {
        const sheet = await readSpreadsheet(buffer, name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx');
        content = [sheet.headers.join(' | '), ...sheet.rows.map((r) => sheet.headers.map((h) => r.cells[h] ?? '').join(' | '))].join('\n');
      } else content = buffer.toString('utf8');
      content = content.trim();
      if (!content) throw AppError.badRequest('Nothing readable was found in this file.');

      let fileUrl: string | null = null;
      try {
        fileUrl = (await storageProvider.uploadFile(buffer, name, 'guide-knowledge')).url;
      } catch (err) {
        logger.warn({ err }, 'Could not store the original guide file; keeping the text only');
      }
      await this.db.guideKnowledge.update({ where: { id }, data: { content, fileUrl, status: GuideKnowledgeStatus.READY, error: null } });
      this.enqueueSummary(() => this.summarize(id, title, content));
    } catch (err) {
      logger.error({ err, id }, 'Reading a guide file failed');
      const message = err instanceof AppError ? err.message : 'This file could not be read. Try a smaller or clearer copy.';
      await this.db.guideKnowledge.update({ where: { id }, data: { status: GuideKnowledgeStatus.FAILED, error: message } }).catch(() => undefined);
    }
  }

  /** Writes the "what it learned" summary, then refreshes the upload suggestions. */
  private async summarize(id: string, title: string, content: string) {
    try {
      await this.loadAiKey();
      const summary = await summarizeKnowledge(title, content);
      if (summary) await this.db.guideKnowledge.update({ where: { id }, data: { summary } });
    } catch (err) {
      logger.warn({ err, id }, 'Guide summary failed');
    }
    this.scheduleSuggestions();
  }

  /** "What to upload next" runs once after a batch of uploads settles, not after every file. */
  private suggestionsTimer: NodeJS.Timeout | null = null;
  private scheduleSuggestions(): void {
    if (this.suggestionsTimer) clearTimeout(this.suggestionsTimer);
    this.suggestionsTimer = setTimeout(() => {
      this.suggestionsTimer = null;
      this.enqueueSummary(async () => {
        await this.refreshSuggestions();
      });
    }, 20_000);
    this.suggestionsTimer.unref?.();
  }

  /** Removes every knowledge item (and the old upload suggestions). Visitor chats are kept. */
  async deleteAllKnowledge(adminId: string): Promise<{ removed: number }> {
    const { count } = await this.db.guideKnowledge.deleteMany({});
    await this.db.platformSetting.deleteMany({ where: { key: SUGGESTIONS_KEY } });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_CLEARED', 'GuideKnowledge', 'all', { removed: count });
    return { removed: count };
  }

  async deleteKnowledge(adminId: string, id: string): Promise<void> {
    const row = await this.db.guideKnowledge.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('Item not found');
    await this.db.guideKnowledge.delete({ where: { id } });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_DELETED', 'GuideKnowledge', id, { title: row.title });
    this.scheduleSuggestions();
  }

  private async knowledgeText(): Promise<string> {
    const rows = await this.db.guideKnowledge.findMany({
      where: { status: GuideKnowledgeStatus.READY },
      orderBy: { createdAt: 'asc' },
      select: { title: true, content: true },
    });
    let out = '';
    for (const r of rows) {
      const block = `### ${r.title}\n${r.content}\n\n`;
      if (out.length + block.length > KNOWLEDGE_BUDGET_CHARS) {
        logger.warn('Guide knowledge exceeds the per-answer budget; newest items are left out');
        break;
      }
      out += block;
    }
    return out.trim();
  }

  // ─── Upload suggestions ────────────────────────────────────────────────────

  async getSuggestions(): Promise<{ text: string; updatedAt: Date | null }> {
    const row = await this.db.platformSetting.findUnique({ where: { key: SUGGESTIONS_KEY } });
    const value = (row?.value ?? {}) as { text?: string };
    return { text: value.text ?? '', updatedAt: row?.updatedAt ?? null };
  }

  /** Asks the AI what is still missing. Runs in the background after every change. */
  async refreshSuggestions(): Promise<{ text: string; updatedAt: Date | null }> {
    try {
      await this.loadAiKey();
      const rows = await this.db.guideKnowledge.findMany({
        where: { status: GuideKnowledgeStatus.READY },
        orderBy: { createdAt: 'asc' },
        select: { title: true, kind: true, content: true, summary: true },
      });
      const overview = rows
        .map((r) => `- ${r.title} (${r.kind}): ${(r.summary || r.content.slice(0, 600)).replace(/\s+/g, ' ').slice(0, 900)}`)
        .join('\n');
      const text = await suggestUploads(overview);
      if (text) {
        const value = { text } as Prisma.InputJsonValue;
        await this.db.platformSetting.upsert({ where: { key: SUGGESTIONS_KEY }, create: { key: SUGGESTIONS_KEY, value }, update: { value } });
      }
    } catch (err) {
      logger.error({ err }, 'Guide upload suggestions failed');
    }
    return this.getSuggestions();
  }

  // ─── Visitor chat ──────────────────────────────────────────────────────────

  async start(input: { name: string; email: string; phone: string; country?: string }) {
    const token = randomBytes(24).toString('hex');
    const conversation = await this.db.guideConversation.create({
      data: {
        token,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        country: input.country?.trim() || null,
      },
    });
    return { token, name: conversation.name };
  }

  private async findByToken(token: string) {
    const conversation = await this.db.guideConversation.findUnique({ where: { token } });
    if (!conversation) throw AppError.notFound('This chat has expired. Please start again.');
    return conversation;
  }

  async history(token: string) {
    const c = await this.findByToken(token);
    return { name: c.name, country: c.country, messages: (c.messages as unknown as StoredTurn[]) ?? [], saved: (c.saved as unknown as GuideSavedItem[]) ?? [] };
  }

  /** Compact list of live catalogue products the guide may show, refreshed every 10 minutes. */
  private catalogueCache: { at: number; text: string; bySlug: Map<string, CatalogueEntry> } | null = null;
  private async catalogue() {
    if (this.catalogueCache && Date.now() - this.catalogueCache.at < 10 * 60 * 1000) return this.catalogueCache;
    const rows = await this.db.product.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        OR: [{ brandId: null }, { brand: { status: BrandStatus.ACTIVE } }],
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      take: 300,
      select: {
        slug: true, name: true, materials: true, description: true, howItIsMade: true, placeOfOrigin: true, moq: true, adminPrice: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        priceTiers: { select: { adminPrice: true } },
      },
    });
    const bySlug = new Map<string, CatalogueEntry>();
    const lines = rows.map((r) => {
      const prices = [r.adminPrice, ...r.priceTiers.map((t) => t.adminPrice)].map((d) => (d ? Number(d) : 0)).filter((n) => n > 0);
      const fromInr = prices.length ? Math.min(...prices) : null;
      const story = (r.howItIsMade || r.description || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      bySlug.set(r.slug, {
        slug: r.slug, name: r.name, image: r.images[0]?.url ?? null, category: r.category.name,
        story, origin: r.placeOfOrigin, moq: r.moq, fromInr,
      });
      return [
        `${r.slug}: ${r.name}`,
        r.category.name,
        r.materials?.slice(0, 50),
        fromInr ? `from INR ${Math.round(fromInr)} per piece, MOQ ${r.moq}` : `MOQ ${r.moq}`,
        r.placeOfOrigin,
        story.slice(0, 120),
      ].filter(Boolean).join(' | ');
    });
    this.catalogueCache = { at: Date.now(), text: lines.join('\n'), bySlug };
    return this.catalogueCache;
  }

  /** Turns the model's picks into cards: real catalogue data where it exists, a web photo for ideas. */
  private async buildPicks(raw: RawPick[], bySlug: Map<string, CatalogueEntry> | undefined): Promise<GuidePick[]> {
    const ideaQueries = raw.filter((r) => !(r.code && bySlug?.has(r.code))).map((r) => r.photo || r.name || '');
    const photos = ideaQueries.length ? await findWebPhotos(ideaQueries) : [];
    const photoFor = new Map(photos.map((p) => [p.query, p]));
    const clean = (v?: string) => (v ? String(v).replace(/[*_`]/g, '').trim().slice(0, 300) : undefined);
    const picks: GuidePick[] = [];
    for (const r of raw) {
      const entry = r.code ? bySlug?.get(r.code) : undefined;
      if (entry) {
        picks.push({
          key: `p:${entry.slug}`,
          source: 'catalogue',
          name: entry.name,
          image: entry.image,
          link: `/products/${entry.slug}`,
          category: entry.category,
          origin: entry.origin ?? undefined,
          moq: entry.moq,
          story: clean(r.story) || entry.story,
          why: clean(r.why) ?? '',
          cost: entry.fromInr ? `from ₹${Math.round(entry.fromInr).toLocaleString('en-IN')}` : clean(r.cost),
          shipping: clean(r.shipping),
          duty: clean(r.duty),
          landed: clean(r.landed),
          sell: clean(r.sell),
        });
        continue;
      }
      if (!r.name) continue;
      const q = (r.photo || r.name).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
      const photo = photoFor.get(q);
      picks.push({
        key: `i:${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
        source: 'idea',
        name: clean(r.name)!.slice(0, 80),
        image: photo?.image ?? null,
        link: photo?.link ?? null,
        credit: photo ? `${photo.credit}, ${photo.license}` : undefined,
        story: clean(r.story) ?? '',
        why: clean(r.why) ?? '',
        cost: clean(r.cost),
        shipping: clean(r.shipping),
        duty: clean(r.duty),
        landed: clean(r.landed),
        sell: clean(r.sell),
      });
    }
    return picks;
  }

  /** Like or save a recommended product (stored on the chat so the team can see what the visitor liked). */
  async toggleSaved(token: string, item: { key: string; name: string; image: string | null; link: string | null }, kind: 'liked' | 'saved', on: boolean) {
    const c = await this.findByToken(token);
    const list = ((c.saved as unknown as GuideSavedItem[]) ?? []).slice();
    const at = list.findIndex((s) => s.key === item.key);
    const current = at >= 0 ? list[at] : { ...item, liked: false, saved: false };
    const next = { ...current, [kind]: on };
    if (at >= 0) list.splice(at, 1);
    if (next.liked || next.saved) list.unshift(next);
    await this.db.guideConversation.update({ where: { id: c.id }, data: { saved: list.slice(0, 60) as unknown as Prisma.InputJsonValue } });
    return list;
  }

  async chat(token: string, message: string): Promise<{ reply: string; followUps: string[]; whatsapp: boolean; products: GuideProductCard[]; photos: GuideWebPhoto[]; picks: GuidePick[]; note: string; messages: StoredTurn[] }> {
    const c = await this.findByToken(token);
    const messages = ((c.messages as unknown as StoredTurn[]) ?? []).slice();
    const visitorTurns = messages.filter((m) => m.role === 'user').length;
    if (visitorTurns >= MAX_VISITOR_MESSAGES) {
      throw AppError.badRequest('This chat has reached its limit. Our team will contact you, or start a new chat.');
    }
    messages.push({ role: 'user', content: message.trim(), at: new Date().toISOString() });

    const [knowledgeOnly, settings, catalogue] = await Promise.all([
      this.knowledgeText(),
      this.getSettings(),
      this.catalogue().catch((err) => {
        logger.warn({ err }, 'Guide catalogue unavailable');
        return null;
      }),
      this.loadAiKey(),
    ]);
    const knowledge = catalogue?.text
      ? `${knowledgeOnly}\n\nSOLOMON CATALOGUE (code: name | category | materials | buyer price in India | origin | story):\n${catalogue.text}`
      : knowledgeOnly;
    const saved = (c.saved as unknown as GuideSavedItem[]) ?? [];
    const liked = saved.filter((s) => s.liked || s.saved).map((s) => s.name);
    const visitor = `${c.name}${c.country ? `, lives in ${c.country}` : ''}${liked.length ? `. Products they liked or saved so far: ${liked.slice(0, 12).join(', ')}` : ''}`;
    // The last 40 turns are plenty of context and keep each answer affordable.
    const recent = messages.slice(-40).map(({ role, content }) => ({ role, content }));
    if (recent[0]?.role !== 'user') recent.shift();
    const parsed = parseGuideReply(await guideReply(knowledge, visitor, recent, settings.allowWebSearch));
    const { followUps, whatsapp, productSlugs, imageQueries } = parsed;
    // If picks failed to resolve, keep the note in the main text so nothing is lost.
    const reply = parsed.picks.length ? parsed.content : [parsed.content, parsed.note].filter(Boolean).join('\n\n');
    const products = productSlugs
      .map((slug) => catalogue?.bySlug.get(slug))
      .filter((p): p is CatalogueEntry => Boolean(p))
      .map(({ slug, name, image, category }) => ({ slug, name, image, category }));
    const [photos, picks] = await Promise.all([
      imageQueries.length ? findWebPhotos(imageQueries) : Promise.resolve([] as GuideWebPhoto[]),
      parsed.picks.length ? this.buildPicks(parsed.picks, catalogue?.bySlug) : Promise.resolve([] as GuidePick[]),
    ]);

    messages.push({
      role: 'assistant',
      content: reply,
      at: new Date().toISOString(),
      ...(followUps.length ? { followUps } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      ...(products.length ? { products } : {}),
      ...(photos.length ? { photos } : {}),
      ...(picks.length ? { picks } : {}),
      ...(picks.length && parsed.note ? { note: parsed.note } : {}),
    });
    await this.db.guideConversation.update({
      where: { id: c.id },
      data: { messages: messages as unknown as Prisma.InputJsonValue, messageCount: messages.length },
    });
    return { reply, note: picks.length ? parsed.note : '', followUps, whatsapp, products, photos, picks, messages };
  }

  // ─── Admin: conversations ──────────────────────────────────────────────────

  async listConversations(page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.db.guideConversation.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true, email: true, phone: true, country: true, messageCount: true, createdAt: true, updatedAt: true },
      }),
      this.db.guideConversation.count(),
    ]);
    return { rows, total };
  }

  async getConversation(id: string) {
    const c = await this.db.guideConversation.findUnique({ where: { id } });
    if (!c) throw AppError.notFound('Conversation not found');
    return { ...c, token: undefined };
  }
}

export const guideService = new GuideService();
