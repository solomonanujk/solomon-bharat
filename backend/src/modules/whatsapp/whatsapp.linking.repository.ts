import { Prisma, PrismaClient, SellerProfile, WhatsAppLinkCode } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class WhatsAppLinkingRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findSellerByUserId(userId: string): Promise<SellerProfile | null> {
    return this.db.sellerProfile.findFirst({ where: { userId, deletedAt: null } });
  }

  /** The seller who verified this number, if any. Used by the conversation to know who is writing. */
  findSellerByWhatsAppNumber(phone: string): Promise<SellerProfile | null> {
    return this.db.sellerProfile.findFirst({ where: { whatsappNumber: phone, deletedAt: null } });
  }

  countCodesSince(sellerId: string, since: Date): Promise<number> {
    return this.db.whatsAppLinkCode.count({ where: { sellerId, createdAt: { gte: since } } });
  }

  createCode(input: { sellerId: string; phone: string; codeHash: string; expiresAt: Date }): Promise<WhatsAppLinkCode> {
    return this.db.whatsAppLinkCode.create({ data: input });
  }

  deleteCode(id: string): Promise<unknown> {
    return this.db.whatsAppLinkCode.delete({ where: { id } });
  }

  latestCode(sellerId: string): Promise<WhatsAppLinkCode | null> {
    return this.db.whatsAppLinkCode.findFirst({ where: { sellerId }, orderBy: { createdAt: 'desc' } });
  }

  incrementAttempts(id: string): Promise<unknown> {
    return this.db.whatsAppLinkCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  /** Saves the verified number and removes the seller's codes. False when another seller already has it. */
  async link(sellerId: string, phone: string): Promise<boolean> {
    try {
      await this.db.$transaction([
        this.db.sellerProfile.update({
          where: { id: sellerId },
          data: { whatsappNumber: phone, whatsappVerifiedAt: new Date() },
        }),
        this.db.whatsAppLinkCode.deleteMany({ where: { sellerId } }),
      ]);
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }

  unlink(sellerId: string): Promise<unknown> {
    return this.db.sellerProfile.update({
      where: { id: sellerId },
      data: { whatsappNumber: null, whatsappVerifiedAt: null },
    });
  }
}
