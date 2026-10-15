import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';
import { GuideKnowledgeKind, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { readSpreadsheet } from '../product-import/parsers/spreadsheet';
import { ChatTurn, extractTextFromImage, extractTextFromPdf, guideReply, setAdminGeminiKey, suggestUploads, verifyGeminiKey } from './guide.ai';

/** Longest single chat, in visitor messages, before the guide asks them to talk to the team. */
export const MAX_VISITOR_MESSAGES = 60;
/** Characters of knowledge sent with each answer (roughly 250k tokens). */
const KNOWLEDGE_BUDGET_CHARS = 900_000;
const SETTINGS_KEY = 'guide_settings';
const SUGGESTIONS_KEY = 'guide_upload_suggestions';
const AI_KEY_SETTING = 'guide_gemini_key';

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
}

type IncomingFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export class GuideService {
  constructor(private readonly db: PrismaClient = prisma) {}

  // ─── AI key (admin-entered Gemini key) ─────────────────────────────────────

  private keyLoadedAt = 0;

  /** Loads the saved key into the AI module; re-read at most once a minute. */
  async loadAiKey(force = false): Promise<void> {
    if (!force && Date.now() - this.keyLoadedAt < 60_000) return;
    const row = await this.db.platformSetting.findUnique({ where: { key: AI_KEY_SETTING } });
    const stored = (row?.value as { encrypted?: string } | null)?.encrypted;
    setAdminGeminiKey(stored ? decrypt(stored) : '');
    this.keyLoadedAt = Date.now();
  }

  async getAiKeyStatus(): Promise<{ source: 'server' | 'admin' | 'none'; last4: string | null; provider: 'gemini' | 'claude' | 'none' }> {
    if (env.GEMINI_API_KEY) return { source: 'server', last4: env.GEMINI_API_KEY.slice(-4), provider: 'gemini' };
    const row = await this.db.platformSetting.findUnique({ where: { key: AI_KEY_SETTING } });
    const stored = (row?.value as { encrypted?: string } | null)?.encrypted;
    const key = stored ? decrypt(stored) : '';
    if (key) return { source: 'admin', last4: key.slice(-4), provider: 'gemini' };
    return { source: 'none', last4: null, provider: env.ANTHROPIC_API_KEY ? 'claude' : 'none' };
  }

  async saveAiKey(adminId: string, key: string) {
    const clean = key.trim();
    if (!(await verifyGeminiKey(clean))) {
      throw AppError.badRequest('Google did not accept this key. Copy it again from Google AI Studio and check it has the Gemini API enabled.');
    }
    const value = { encrypted: encrypt(clean) };
    await this.db.platformSetting.upsert({ where: { key: AI_KEY_SETTING }, create: { key: AI_KEY_SETTING, value }, update: { value } });
    await this.loadAiKey(true);
    await writeAuditLog(adminId, 'GUIDE_AI_KEY_SAVED', 'PlatformSetting', AI_KEY_SETTING, { last4: clean.slice(-4) });
    return this.getAiKeyStatus();
  }

  async removeAiKey(adminId: string) {
    await this.db.platformSetting.deleteMany({ where: { key: AI_KEY_SETTING } });
    await this.loadAiKey(true);
    await writeAuditLog(adminId, 'GUIDE_AI_KEY_REMOVED', 'PlatformSetting', AI_KEY_SETTING, {});
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

  listKnowledge() {
    return this.db.guideKnowledge.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, kind: true, fileUrl: true, fileName: true, sizeBytes: true, createdAt: true, content: true },
    }).then((rows) => rows.map(({ content, ...r }) => ({ ...r, characters: content.length, preview: content.slice(0, 400) })));
  }

  async addText(adminId: string, title: string, text: string) {
    const row = await this.db.guideKnowledge.create({
      data: { title: title.trim(), kind: GuideKnowledgeKind.TEXT, content: text.trim(), createdById: adminId },
    });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_ADDED', 'GuideKnowledge', row.id, { title: row.title, kind: row.kind });
    void this.refreshSuggestions();
    return row;
  }

  /** Reads the file into text the AI can learn from, keeps the original, and stores both. */
  async addFile(adminId: string, file: IncomingFile, title?: string) {
    await this.loadAiKey();
    const name = file.originalname;
    const lower = name.toLowerCase();
    let kind: GuideKnowledgeKind;
    let content: string;

    if (file.mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
      kind = GuideKnowledgeKind.PDF;
      content = await extractTextFromPdf(file.buffer);
    } else if (IMAGE_TYPES.has(file.mimetype)) {
      kind = GuideKnowledgeKind.IMAGE;
      content = await extractTextFromImage(file.buffer, file.mimetype as 'image/png');
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
      kind = GuideKnowledgeKind.SPREADSHEET;
      const sheet = await readSpreadsheet(file.buffer, lower.endsWith('.csv') ? 'csv' : 'xlsx');
      content = [sheet.headers.join(' | '), ...sheet.rows.map((r) => sheet.headers.map((h) => r.cells[h] ?? '').join(' | '))].join('\n');
    } else if (lower.endsWith('.txt') || lower.endsWith('.md') || file.mimetype.startsWith('text/')) {
      kind = GuideKnowledgeKind.TEXT;
      content = file.buffer.toString('utf8');
    } else {
      throw AppError.badRequest('Upload a PDF, an image (PNG, JPG, WebP), a spreadsheet (.xlsx, .csv) or a text file. For Word files, save as PDF first.');
    }
    content = content.trim();
    if (!content) throw AppError.badRequest('Nothing readable was found in this file.');

    let fileUrl: string | null = null;
    try {
      fileUrl = (await storageProvider.uploadFile(file.buffer, name, 'guide-knowledge')).url;
    } catch (err) {
      logger.error({ err }, 'Could not store the original guide file; keeping the extracted text only');
    }

    const row = await this.db.guideKnowledge.create({
      data: {
        title: (title?.trim() || name.replace(/\.[^.]+$/, '')).slice(0, 200),
        kind,
        content,
        fileUrl,
        fileName: name,
        sizeBytes: file.size,
        createdById: adminId,
      },
    });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_ADDED', 'GuideKnowledge', row.id, { title: row.title, kind: row.kind });
    void this.refreshSuggestions();
    return row;
  }

  async deleteKnowledge(adminId: string, id: string): Promise<void> {
    const row = await this.db.guideKnowledge.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('Item not found');
    await this.db.guideKnowledge.delete({ where: { id } });
    await writeAuditLog(adminId, 'GUIDE_KNOWLEDGE_DELETED', 'GuideKnowledge', id, { title: row.title });
    void this.refreshSuggestions();
  }

  private async knowledgeText(): Promise<string> {
    const rows = await this.db.guideKnowledge.findMany({ orderBy: { createdAt: 'asc' }, select: { title: true, content: true } });
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
      const rows = await this.db.guideKnowledge.findMany({ orderBy: { createdAt: 'asc' }, select: { title: true, kind: true, content: true } });
      const overview = rows.map((r) => `- ${r.title} (${r.kind}): ${r.content.slice(0, 600).replace(/\s+/g, ' ')}`).join('\n');
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
    return { name: c.name, messages: (c.messages as unknown as StoredTurn[]) ?? [] };
  }

  async chat(token: string, message: string): Promise<{ reply: string; messages: StoredTurn[] }> {
    const c = await this.findByToken(token);
    const messages = ((c.messages as unknown as StoredTurn[]) ?? []).slice();
    const visitorTurns = messages.filter((m) => m.role === 'user').length;
    if (visitorTurns >= MAX_VISITOR_MESSAGES) {
      throw AppError.badRequest('This chat has reached its limit. Our team will contact you, or start a new chat.');
    }
    messages.push({ role: 'user', content: message.trim(), at: new Date().toISOString() });

    const [knowledge, settings] = await Promise.all([this.knowledgeText(), this.getSettings(), this.loadAiKey()]);
    const visitor = `${c.name}${c.country ? `, lives in ${c.country}` : ''}`;
    // The last 40 turns are plenty of context and keep each answer affordable.
    const recent = messages.slice(-40).map(({ role, content }) => ({ role, content }));
    if (recent[0]?.role !== 'user') recent.shift();
    const reply = await guideReply(knowledge, visitor, recent, settings.allowWebSearch);

    messages.push({ role: 'assistant', content: reply, at: new Date().toISOString() });
    await this.db.guideConversation.update({
      where: { id: c.id },
      data: { messages: messages as unknown as Prisma.InputJsonValue, messageCount: messages.length },
    });
    return { reply, messages };
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
