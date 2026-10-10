import { ImportDimensions, ImportPublishedState, SheetRow } from '../product-import.types';
import { cell, IMPORT_LIMITS, parseQuantity } from './shared';

/**
 * Shopify-only field readers. Shopify's product CSV has two header generations: the
 * legacy names ("Variant SKU", "Body (HTML)") and the current ones ("SKU", "Description").
 * Both are accepted; the first non-empty alias wins. Deliberately separate from the
 * WooCommerce readers.
 */
export const SHOPIFY_COLUMNS = {
  handle: ['handle', 'url handle'],
  title: ['title'],
  body: ['body (html)', 'description'],
  category: ['product category'],
  type: ['type'],
  tags: ['tags'],
  published: ['published', 'published on online store'],
  status: ['status'],
  sku: ['variant sku', 'sku'],
  grams: ['variant grams', 'weight value (grams)'],
  stock: ['variant inventory qty', 'inventory quantity'],
  price: ['variant price', 'price'],
  imageSrc: ['image src', 'product image url'],
  imagePosition: ['image position'],
  variantImage: ['variant image', 'variant image url'],
  length: ['packed product length'],
  width: ['packed product width'],
  height: ['packed product height'],
  dimensionUnit: ['packed product dimension unit'],
} as const;

export type ShopifyColumn = readonly string[];

export const DIMENSIONS_INCOMPLETE_ISSUE = 'Dimensions incomplete — length, width and height are all needed';

/** First non-empty value among the header aliases ('' when none). */
export function cellAny(row: SheetRow, aliases: ShopifyColumn): string {
  for (const alias of aliases) {
    const value = cell(row, alias);
    if (value) return value;
  }
  return '';
}

/** Weight value (grams) is ALWAYS grams; the weight unit column is display-only. */
export function readShopifyWeightKg(row: SheetRow): number | null {
  const grams = parseQuantity(cellAny(row, SHOPIFY_COLUMNS.grams));
  if (grams === null || grams <= 0) return null;
  // kg to 3 decimals == whole grams.
  const rounded = Math.round(grams) / 1000;
  return Math.min(Math.max(rounded, 0.001), IMPORT_LIMITS.maxWeightKg);
}

/** Numeric inventory; negative (oversold) -> 0; blank/non-numeric -> null (not stated). */
export function readShopifyStock(row: SheetRow): number | null {
  const raw = cellAny(row, SHOPIFY_COLUMNS.stock);
  if (!raw) return null;
  const n = parseQuantity(raw);
  if (n !== null) return Math.min(Math.floor(n), IMPORT_LIMITS.maxStock);
  return /^-\s*\d/.test(raw) ? 0 : null;
}

/** Packed product length/width/height + unit (cm|in). All four needed. */
export function readShopifyDimensions(row: SheetRow): { value: ImportDimensions | null; partial: boolean } {
  const sides = [SHOPIFY_COLUMNS.length, SHOPIFY_COLUMNS.width, SHOPIFY_COLUMNS.height].map((c) =>
    parseQuantity(cellAny(row, c)),
  );
  const given = sides.filter((n): n is number => n !== null && n > 0);
  if (given.length === 0) return { value: null, partial: false };
  const unit = cellAny(row, SHOPIFY_COLUMNS.dimensionUnit).toLowerCase();
  if (given.length < 3 || (unit !== 'cm' && unit !== 'in')) return { value: null, partial: true };
  const [length, width, height] = given.map((n) => Math.round(n * 100) / 100);
  if ([length, width, height].some((n) => n <= 0 || n > IMPORT_LIMITS.maxDimension)) {
    return { value: null, partial: true };
  }
  return { value: { length, width, height, unit }, partial: false };
}

export function splitShopifyTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** "A > B > C" -> ['A','B','C']. A purely numeric taxonomy id (e.g. "2271") is ignored. */
export function splitShopifyCategory(value: string): string[] {
  const segments = value
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0 || segments.every((s) => /^\d+$/.test(s))) return [];
  return segments;
}

function truthy(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return null;
}

/** Status + Published from the product's first row. */
export function readShopifyPublished(status: string, published: string): ImportPublishedState | null {
  const s = status.trim().toLowerCase();
  const p = truthy(published);
  if (s === 'archived') return 'private';
  if (s === 'draft') return 'draft';
  if (s === 'active') return p === false ? 'private' : 'published';
  if (p === true) return 'published';
  if (p === false) return 'private';
  return null;
}
