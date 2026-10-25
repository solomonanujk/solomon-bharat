import { UserStatus } from '@prisma/client';
import { normalizeWhatsAppNumber, templateParam } from '../../providers/whatsapp';
import { AudienceSpec } from './bulk-messages.validation';

/** A registered seller as the audience query returns them. */
export interface AudienceCandidate {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  whatsappNumber: string | null;
  whatsappOptedOutAt: Date | null;
  user: { email: string; status: UserStatus };
}

export interface ResolvedRecipient {
  sellerId: string;
  /** The seller's verified WhatsApp number (E.164). */
  phone: string;
  businessName: string;
  contactName: string;
  /** The seller's own CSV row, when the audience came from a CSV. */
  csvRow?: Record<string, string>;
}

export interface SkippedCounts {
  /** Registered sellers who have not verified a WhatsApp number. */
  notLinked: number;
  optedOut: number;
  suspended: number;
  /** CSV rows that matched no registered seller (never messaged). */
  unmatched: number;
  /** CSV rows naming a seller already in the list. */
  duplicate: number;
}

export interface ResolvedAudience {
  recipients: ResolvedRecipient[];
  skipped: SkippedCounts;
}

const emptySkipped = (): SkippedCounts => ({ notLinked: 0, optedOut: 0, suspended: 0, unmatched: 0, duplicate: 0 });

/** The identifiers a CSV cell can match a seller by. */
export function csvKeys(seller: AudienceCandidate): string[] {
  const keys = [seller.user.email.trim().toLowerCase()];
  for (const phone of [seller.whatsappNumber, seller.phone]) {
    const normalized = normalizeWhatsAppNumber(phone);
    if (normalized) keys.push(normalized);
  }
  return keys;
}

/**
 * The keys a CSV cell can stand for: an email in lowercase, or a phone number. A bare 10-digit number
 * (no country code, as most Indian sheets are written) is tried as an Indian +91 number too.
 */
export function csvLookupKeys(cell: string): string[] {
  const value = cell.trim();
  if (!value) return [];
  if (value.includes('@')) return [value.toLowerCase()];
  const keys: string[] = [];
  const digits = value.replace(/\D/g, '');
  if (!value.startsWith('+') && digits.length === 10) keys.push(`+91${digits}`);
  const normalized = normalizeWhatsAppNumber(value);
  if (normalized) keys.push(normalized);
  return keys;
}

/** The first key for a CSV cell, or null. */
export function csvLookupKey(cell: string): string | null {
  return csvLookupKeys(cell)[0] ?? null;
}

/**
 * Turns the sellers matched by the audience spec into who gets a message. Only registered sellers
 * with a verified WhatsApp number who have not opted out and are not suspended are eligible.
 * Everyone else is counted, never silently dropped.
 */
export function resolveAudience(candidates: AudienceCandidate[], spec: AudienceSpec): ResolvedAudience {
  const skipped = emptySkipped();
  const recipients: ResolvedRecipient[] = [];
  const seen = new Set<string>();

  const consider = (seller: AudienceCandidate, csvRow?: Record<string, string>): void => {
    if (seen.has(seller.id)) {
      skipped.duplicate += 1;
      return;
    }
    seen.add(seller.id);
    if (seller.user.status !== UserStatus.ACTIVE) {
      skipped.suspended += 1;
      return;
    }
    const phone = normalizeWhatsAppNumber(seller.whatsappNumber);
    if (!phone) {
      skipped.notLinked += 1;
      return;
    }
    if (seller.whatsappOptedOutAt) {
      skipped.optedOut += 1;
      return;
    }
    recipients.push({
      sellerId: seller.id,
      phone,
      businessName: seller.businessName,
      contactName: seller.contactName,
      ...(csvRow ? { csvRow } : {}),
    });
  };

  if (spec.mode === 'CSV') {
    const byKey = new Map<string, AudienceCandidate>();
    for (const seller of candidates) for (const key of csvKeys(seller)) if (!byKey.has(key)) byKey.set(key, seller);
    for (const row of spec.csvRows ?? []) {
      const seller = csvLookupKeys(row[spec.csvKeyColumn ?? ''] ?? '')
        .map((key) => byKey.get(key))
        .find((s) => s !== undefined);
      if (!seller) {
        skipped.unmatched += 1;
        continue;
      }
      consider(seller, row);
    }
  } else {
    for (const seller of candidates) consider(seller);
  }

  return { recipients, skipped };
}

/**
 * The values for {{1}}, {{2}} ... for one recipient. Every value is flattened to one line and capped
 * (Meta rejects newlines and tabs in a parameter) and is never empty.
 */
export function buildVariables(mapping: string[], recipient: ResolvedRecipient): string[] {
  return mapping.map((source) => {
    if (source === 'seller.businessName') return templateParam(recipient.businessName);
    if (source === 'seller.contactName') return templateParam(recipient.contactName);
    if (source.startsWith('fixed:')) return templateParam(source.slice('fixed:'.length));
    if (source.startsWith('csv:')) return templateParam(recipient.csvRow?.[source.slice('csv:'.length)] ?? '');
    return templateParam('');
  });
}
