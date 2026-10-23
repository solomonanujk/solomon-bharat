import { Prisma, PrismaClient, WhatsAppSession, WhatsAppSessionState } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionUpdate {
  state?: WhatsAppSessionState;
  language?: string;
  texts?: string[];
  collected?: Prisma.InputJsonValue;
  missing?: string[];
  aiCalls?: number;
}

export class WhatsAppSessionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** The seller's open listing, if it has not expired. */
  async findActive(phone: string): Promise<WhatsAppSession | null> {
    const session = await this.db.whatsAppSession.findUnique({ where: { phone } });
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await this.delete(phone);
      return null;
    }
    return session;
  }

  /** Starts a listing; `created` is false when one already existed (two photos arriving together). */
  async start(sellerId: string, phone: string, language: string): Promise<{ session: WhatsAppSession; created: boolean }> {
    try {
      const session = await this.db.whatsAppSession.create({
        data: { sellerId, phone, language, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      });
      return { session, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const session = await this.db.whatsAppSession.findUniqueOrThrow({ where: { phone } });
        return { session, created: false };
      }
      throw err;
    }
  }

  private touch(): { lastMessageAt: Date; expiresAt: Date } {
    return { lastMessageAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
  }

  appendText(phone: string, text: string): Promise<WhatsAppSession> {
    return this.db.whatsAppSession.update({ where: { phone }, data: { texts: { push: text }, ...this.touch() } });
  }

  appendImage(phone: string, url: string): Promise<WhatsAppSession> {
    return this.db.whatsAppSession.update({ where: { phone }, data: { imageUrls: { push: url }, ...this.touch() } });
  }

  appendVideo(phone: string, url: string): Promise<WhatsAppSession> {
    return this.db.whatsAppSession.update({ where: { phone }, data: { videoUrls: { push: url }, ...this.touch() } });
  }

  update(phone: string, data: SessionUpdate): Promise<WhatsAppSession> {
    return this.db.whatsAppSession.update({ where: { phone }, data });
  }

  async delete(phone: string): Promise<void> {
    await this.db.whatsAppSession.deleteMany({ where: { phone } });
  }

  // ─── AI usage (daily cap) ───────────────────────────────────────────────────

  async callsOn(sellerId: string, day: string): Promise<number> {
    const row = await this.db.whatsAppAiUsage.findUnique({ where: { sellerId_day: { sellerId, day } } });
    return row?.calls ?? 0;
  }

  recordCall(sellerId: string, day: string, inputTokens: number, outputTokens: number): Promise<unknown> {
    return this.db.whatsAppAiUsage.upsert({
      where: { sellerId_day: { sellerId, day } },
      create: { sellerId, day, calls: 1, inputTokens, outputTokens },
      update: {
        calls: { increment: 1 },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
      },
    });
  }
}
