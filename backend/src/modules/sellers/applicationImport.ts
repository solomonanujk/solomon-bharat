import { Prisma, SellerApplicationStatus, SellerType } from '@prisma/client';
import { CRAFT_CATEGORIES } from './sellerApplicationOptions.constants';

/** Same version a successful /apply submission records (frontend SELLER_AGREEMENT_VERSION). */
export const IMPORT_AGREEMENT_VERSION = '2026-10-13';

export type ImportRowResult =
  | { kind: 'ok'; email: string; brand: string; data: Prisma.SellerApplicationCreateInput }
  | { kind: 'skip'; brand: string; reason: string }
  | { kind: 'fail'; rowNumber: number; brand: string; reason: string };

const clean = (v: string | undefined): string => (v ?? '').trim();
const orNull = (v: string | undefined): string | null => clean(v) || null;
const isNone = (v: string): boolean => v === '' || v.toLowerCase() === 'none' || v.toLowerCase() === 'null';

/** "7974711689.0" -> "7974711689". */
export function cleanPhone(raw: string | undefined): string {
  return clean(raw).replace(/\.0+$/, '');
}

function parseCategories(raw: string): { categories: string[]; unknown: string[] } {
  if (isNone(raw)) return { categories: [], unknown: [] };
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    list = raw.split(',');
  }
  const values = Array.isArray(list) ? list.map((v) => String(v).trim()).filter(Boolean) : [];
  const known = new Set<string>(CRAFT_CATEGORIES);
  return { categories: values.filter((v) => known.has(v)), unknown: values.filter((v) => !known.has(v)) };
}

function parseYesNo(raw: string): boolean | null {
  const v = raw.toLowerCase();
  if (v === 'yes' || v === 'true') return true;
  if (v === 'no' || v === 'false') return false;
  return null;
}

/**
 * Maps one row of the old-backend applications export to a new SellerApplication.
 * Values are copied as given (no invented answers); fields the old form never asked
 * (GST, incorporation, other platforms) stay empty.
 */
export function mapImportRow(rowNumber: number, cells: Record<string, string>, importedAt: Date): ImportRowResult {
  const get = (key: string): string => {
    const v = clean(cells[key]);
    return isNone(v) ? '' : v;
  };
  const brand = get('brand');
  const email = get('email').toLowerCase();
  const founder = get('founder');
  const phone = cleanPhone(get('phone'));

  if (brand === 'Unnamed Brand' && !email && !founder && !phone) {
    return { kind: 'skip', brand, reason: 'Unnamed Brand with no email, founder or phone' };
  }
  const missing = [!brand && 'brand', !email && 'email', !founder && 'founder', !phone && 'phone'].filter(Boolean);
  if (missing.length > 0) return { kind: 'fail', rowNumber, brand: brand || '(no brand)', reason: `Missing ${missing.join(', ')}` };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: 'fail', rowNumber, brand, reason: `Invalid email "${email}"` };

  const city = get('city');
  const country = get('country');
  const createdRaw = get('created_at');
  const createdAt = createdRaw ? new Date(createdRaw.replace(' ', 'T').replace(/\+00$/, 'Z')) : null;
  if (createdAt && Number.isNaN(createdAt.getTime())) {
    return { kind: 'fail', rowNumber, brand, reason: `Unreadable created_at "${createdRaw}"` };
  }
  const followersRaw = get('followers').replace(/\.0+$/, '');
  const followers = followersRaw ? Number.parseInt(followersRaw, 10) : null;
  const { categories, unknown } = parseCategories(get('categories'));

  const data: Prisma.SellerApplicationCreateInput = {
    businessName: brand.slice(0, 200),
    contactName: founder.slice(0, 200),
    email,
    phone: phone.slice(0, 30),
    businessAddress: [city, country].filter(Boolean).join(', ') || 'Not provided',
    city: city || null,
    country: country || null,
    instagramHandle: orNull(get('instagram')),
    instagramFollowers: followers != null && Number.isFinite(followers) ? followers : null,
    websiteOrSocialLink: orNull(get('website'))?.slice(0, 500) ?? null,
    craftCategories: categories,
    productDescription: orNull(get('product_desc')),
    giTaggedProducts: orNull(get('gi')),
    // Old answer buckets do not line up with the new form's, so the applicant's own words are kept.
    monthlySalesVolume: orNull(get('monthly_volume')),
    shippedInternationally: parseYesNo(get('shipped')),
    approxExportOrders: orNull(get('intl_orders')),
    exportCountries: orNull(get('intl_countries')),
    sellingOnAmazon: orNull(get('amazon')),
    iecStatus: orNull(get('has_iec')),
    businessType: orNull(get('business_type')),
    hearAboutUs: orNull(get('heard_from')),
    brandStory: orNull(get('brand_story')),
    message: unknown.length > 0 ? `Other categories from the old form: ${unknown.join(', ')}` : null,
    sellerType: SellerType.CURATED,
    status: SellerApplicationStatus.PENDING,
    agreedToCommissionTerms: true,
    commissionTermsVersion: IMPORT_AGREEMENT_VERSION,
    commissionAgreedAt: importedAt,
    ...(createdAt ? { createdAt } : {}),
  };
  return { kind: 'ok', email, brand, data };
}
