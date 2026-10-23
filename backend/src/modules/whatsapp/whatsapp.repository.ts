import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface RecordMessageInput {
  providerMessageId: string;
  phone: string;
  type: string;
  mediaCount: number;
}

export class WhatsAppRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Messages received from a number since a time; `withMedia` counts only photo/video/file messages. */
  countSince(phone: string, since: Date, withMedia = false): Promise<number> {
    return this.db.whatsAppMessage.count({
      where: { phone, createdAt: { gte: since }, ...(withMedia ? { mediaCount: { gt: 0 } } : {}) },
    });
  }

  /** Stores the message; false when this provider message id was already seen (a retry). */
  async recordIfNew(input: RecordMessageInput): Promise<boolean> {
    try {
      await this.db.whatsAppMessage.create({ data: input });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }
}
