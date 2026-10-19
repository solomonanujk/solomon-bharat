import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  normalizeWhatsAppNumber,
  sendWithTemplateFallback,
  TemplateCatalog,
  WhatsAppProvider,
  whatsAppProvider,
  whatsAppTemplates,
} from '../../providers/whatsapp';
import { writeAuditLog } from '../../utils/auditLog';
import { AppError } from '../../utils/errors';
import { WhatsAppLinkingRepository } from './whatsapp.linking.repository';

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_MAX_ATTEMPTS = 5;
/** At most this many codes per seller per hour: each one is a paid WhatsApp message. */
export const LINK_MAX_CODES_PER_HOUR = 5;

export interface WhatsAppLinkStatus {
  linked: boolean;
  number: string | null;
  verifiedAt: Date | null;
}

function hashCode(sellerId: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${sellerId}:${code}`).digest('hex');
}

export class WhatsAppLinkingService {
  constructor(
    private readonly repo: WhatsAppLinkingRepository = new WhatsAppLinkingRepository(),
    private readonly provider: WhatsAppProvider = whatsAppProvider,
    private readonly templates: TemplateCatalog = whatsAppTemplates,
  ) {}

  private async requireSeller(userId: string) {
    const seller = await this.repo.findSellerByUserId(userId);
    if (!seller) throw AppError.notFound('Seller profile not found');
    return seller;
  }

  async getStatus(userId: string): Promise<WhatsAppLinkStatus> {
    const seller = await this.requireSeller(userId);
    return {
      linked: Boolean(seller.whatsappNumber),
      number: seller.whatsappNumber,
      verifiedAt: seller.whatsappVerifiedAt,
    };
  }

  /** Sends a 6-digit code to the number; the seller types it back in the portal to prove ownership. */
  async requestCode(userId: string, rawPhone: string): Promise<{ expiresAt: Date }> {
    const seller = await this.requireSeller(userId);
    const phone = normalizeWhatsAppNumber(rawPhone);
    if (!phone) throw AppError.badRequest('Enter a valid WhatsApp number with country code, e.g. +91 98765 43210');

    if (seller.whatsappNumber === phone) throw AppError.conflict('This number is already linked to your account');

    const owner = await this.repo.findSellerByWhatsAppNumber(phone);
    if (owner && owner.id !== seller.id) {
      throw AppError.conflict('This WhatsApp number is already linked to another seller account');
    }

    const recent = await this.repo.countCodesSince(seller.id, new Date(Date.now() - 60 * 60 * 1000));
    if (recent >= LINK_MAX_CODES_PER_HOUR) {
      throw new AppError(429, 'Too many codes requested. Please try again in an hour.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    const row = await this.repo.createCode({ sellerId: seller.id, phone, codeHash: hashCode(seller.id, code), expiresAt });

    try {
      // An approved authentication template reaches a number that has never written to us; plain
      // text only arrives inside the 24-hour window, and is the fallback if the template fails.
      await sendWithTemplateFallback(
        this.provider,
        phone,
        this.templates.authCode(code),
        `Your Solomon Bharat verification code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.`,
      );
    } catch (err) {
      logger.error({ err }, '[whatsapp] could not send link code');
      await this.repo.deleteCode(row.id);
      throw new AppError(502, 'We could not send the code to that WhatsApp number. Check the number and try again.');
    }
    return { expiresAt };
  }

  async verifyCode(userId: string, code: string): Promise<WhatsAppLinkStatus> {
    const seller = await this.requireSeller(userId);
    const row = await this.repo.latestCode(seller.id);
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('That code has expired. Request a new one.');
    }
    if (row.attempts >= LINK_MAX_ATTEMPTS) {
      throw new AppError(429, 'Too many wrong attempts. Request a new code.');
    }

    const given = Buffer.from(hashCode(seller.id, code));
    const expected = Buffer.from(row.codeHash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      await this.repo.incrementAttempts(row.id);
      throw AppError.badRequest('Incorrect code. Check the message on WhatsApp and try again.');
    }

    const linked = await this.repo.link(seller.id, row.phone);
    if (!linked) throw AppError.conflict('This WhatsApp number is already linked to another seller account');

    writeAuditLog(userId, 'WHATSAPP_LINKED', 'SellerProfile', seller.id).catch((err) =>
      logger.warn({ err }, '[whatsapp] audit log failed'),
    );
    return { linked: true, number: row.phone, verifiedAt: new Date() };
  }

  async unlink(userId: string): Promise<WhatsAppLinkStatus> {
    const seller = await this.requireSeller(userId);
    if (seller.whatsappNumber) {
      await this.repo.unlink(seller.id);
      writeAuditLog(userId, 'WHATSAPP_UNLINKED', 'SellerProfile', seller.id).catch((err) =>
        logger.warn({ err }, '[whatsapp] audit log failed'),
      );
    }
    return { linked: false, number: null, verifiedAt: null };
  }
}

export const whatsAppLinkingService = new WhatsAppLinkingService();
