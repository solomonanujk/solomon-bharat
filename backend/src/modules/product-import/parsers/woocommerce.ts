import { ImportDimensions, ImportPublishedState, ParseResult, SheetRow } from '../product-import.types';
import {
  CandidateDraft,
  cell,
  finalizeCandidate,
  IMPORT_LIMITS,
  isMaterialLabel,
  newDraft,
  normalizeHeader,
  parseQuantity,
  uniqueKey,
} from './shared';

/*
 * Mapping of the official WooCommerce Product CSV Import Schema
 * (https://github.com/woocommerce/woocommerce/wiki/Product-CSV-Import-Schema).
 *
 * Imported:   ID, Type, SKU, Name, Published, In stock?, Stock, Weight (unit),
 *             Length/Width/Height (unit), Short description, Description, Regular price,
 *             Categories, Tags, Images, Parent, Attribute N name / value(s) (material-like
 *             ones also feed "materials").
 * Ignored by design: Is featured?, Visibility in catalog, Date sale price starts/ends,
 *             Sale price, Tax status/class, Low stock amount, Backorders allowed?,
 *             Sold individually?, Allow customer reviews?, Purchase note, Shipping class,
 *             Download limit/expiry days, Grouped products, Upsells, Cross-sells,
 *             External URL, Button text, Position, Attribute N default/visible/global,
 *             Download N name/URL, non-material Meta: columns.
 * Skipped rows: grouped, external, virtual and downloadable products.
 */

/** Unit -> kilograms. */
const WEIGHT_TO_KG: Record<string, number> = { kg: 1, g: 0.001, lb: 0.45359237, lbs: 0.45359237, oz: 0.028349523125 };
/** Unit -> centimetres ('in' is kept as inches rather than converted). */
const LENGTH_TO_CM: Record<string, number> = { cm: 1, mm: 0.1, m: 100, yd: 91.44, in: 2.54 };

type Axis = 'length' | 'width' | 'height';
interface UnitColumn {
  header: string;
  unit: string;
}
interface MeasureColumns {
  weight: UnitColumn[];
  length: UnitColumn[];
  width: UnitColumn[];
  height: UnitColumn[];
}

/** WooCommerce exports its attribute columns as "Attribute N name" etc. */
export function isWooCommerceHeaderSet(headers: string[]): boolean {
  const set = new Set(headers);
  return (
    set.has(normalizeHeader('Type')) &&
    set.has(normalizeHeader('Name')) &&
    (set.has(normalizeHeader('Regular price')) || set.has(normalizeHeader('SKU')))
  );
}

/** Indices N for which an "Attribute N name" column exists. */
function attributeIndices(headers: string[]): number[] {
  return headers
    .map((h) => /^attribute (\d+) name$/.exec(h))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Finds `Weight (kg)`, `Length (cm)`… (normalized headers); a bare `Weight` is taken as kg, a bare `Length` as cm. */
function measureColumns(headers: string[]): MeasureColumns {
  const out: MeasureColumns = { weight: [], length: [], width: [], height: [] };
  for (const h of headers) {
    const m = /^(weight|length|width|height)(?:\s*\(\s*([a-z]+)\s*\))?$/.exec(h);
    if (!m) continue;
    const kind = m[1] as keyof MeasureColumns;
    const unit = m[2] ?? (kind === 'weight' ? 'kg' : 'cm');
    if (kind === 'weight' ? unit in WEIGHT_TO_KG : unit in LENGTH_TO_CM) out[kind].push({ header: h, unit });
  }
  return out;
}

function readWeightKg(row: SheetRow, cols: UnitColumn[]): number | null {
  for (const c of cols) {
    const n = parseQuantity(row.cells[c.header]);
    if (n === null || n <= 0) continue;
    const kg = Math.round(n * WEIGHT_TO_KG[c.unit] * 1000) / 1000;
    return kg >= 0.001 && kg <= IMPORT_LIMITS.maxWeightKg ? kg : null;
  }
  return null;
}

/** All three sides are required. Inches stay inches only when every given side is in inches. */
function readDimensions(row: SheetRow, cols: MeasureColumns): { value: ImportDimensions | null; partial: boolean } {
  const sides = {} as Record<Axis, { n: number; unit: string }>;
  let present = 0;
  for (const axis of ['length', 'width', 'height'] as const) {
    for (const c of cols[axis]) {
      const n = parseQuantity(row.cells[c.header]);
      if (n !== null && n > 0) {
        sides[axis] = { n, unit: c.unit };
        present += 1;
        break;
      }
    }
  }
  if (present === 0) return { value: null, partial: false };
  if (present < 3) return { value: null, partial: true };
  const allInches = Object.values(sides).every((s) => s.unit === 'in');
  const conv = (axis: Axis): number => {
    const { n, unit } = sides[axis];
    return Math.round((allInches ? n : n * LENGTH_TO_CM[unit]) * 100) / 100;
  };
  const value: ImportDimensions = {
    length: conv('length'),
    width: conv('width'),
    height: conv('height'),
    unit: allInches ? 'in' : 'cm',
  };
  if ([value.length, value.width, value.height].some((n) => n <= 0 || n > IMPORT_LIMITS.maxDimension)) {
    return { value: null, partial: true };
  }
  return { value, partial: false };
}

function parseStockNumber(raw: string): number | null {
  const n = parseQuantity(raw);
  if (n === null) return null;
  return Math.min(Math.floor(n), IMPORT_LIMITS.maxStock);
}

/** "In stock?" is 1/0 in the export; tolerate yes/no/true/false. */
function isOutOfStock(raw: string): boolean {
  return ['0', 'false', 'no', 'outofstock'].includes(raw.trim().toLowerCase());
}

/**
 * Stock for one row. A number wins (negative numbers from backorders count as 0); `parent`
 * (variations only) takes the parent's number; blank + "In stock?" 0 means 0; blank + in
 * stock is left for the seller (null).
 */
function readStock(row: SheetRow, parentStock: number | null | undefined): number | null {
  const raw = cell(row, 'Stock');
  const outOfStock = isOutOfStock(cell(row, 'In stock?'));
  if (raw.toLowerCase() === 'parent') return parentStock ?? (outOfStock ? 0 : null);
  if (raw) {
    const n = parseStockNumber(raw);
    if (n !== null) return n;
    if (/^-\s*\d/.test(raw)) return 0;
  }
  return outOfStock ? 0 : null;
}

function readPublished(row: SheetRow): ImportPublishedState | null {
  switch (cell(row, 'Published')) {
    case '1':
      return 'published';
    case '0':
      return 'private';
    case '-1':
      return 'draft';
    default:
      return null;
  }
}

/** Comma-separated types, e.g. "variable, downloadable, virtual". */
function typeTokens(row: SheetRow): string[] {
  return cell(row, 'Type')
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Images are comma-separated, but a URL may itself contain commas, so only split on a
 * comma that is followed by the next http(s):// URL. Anything left that isn't a URL
 * (WooCommerce also allows already-uploaded file names) is kept per entry so
 * finalizeCandidate reports it as an unusable image link.
 */
function splitImages(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/,\s*(?=https?:\/\/)/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      if (!/^https?:\/\//i.test(p)) return splitList(p);
      // "https://…/c.jpg, photo.png": a bare file name after ", " is a separate entry, not part of the URL.
      return p.split(/,\s+(?=[^\s,/?#]+\.[a-z0-9]{2,5}(?:\s*,|\s*$))/i).map((x) => x.trim());
    });
}

/** "A > B > C, D" -> [[A,B,C],[D]]. */
function splitCategories(value: string): string[][] {
  return splitList(value)
    .map((entry) =>
      entry
        .split('>')
        .map((seg) => seg.trim())
        .filter(Boolean),
    )
    .filter((path) => path.length > 0);
}

function skipReason(tokens: string[]): { text: string; named: boolean } | null {
  if (tokens.includes('grouped')) return { text: "grouped products can't be imported", named: false };
  if (tokens.includes('external')) return { text: "external/affiliate products can't be imported", named: false };
  if (tokens.includes('virtual')) return { text: 'virtual products have nothing to ship', named: true };
  if (tokens.includes('downloadable')) return { text: 'downloadable products have nothing to ship', named: true };
  return null;
}

/**
 * WooCommerce product CSV: one row per product, plus one row per variation of a
 * variable product. A variation points at its parent through `Parent`, written as
 * either "id:123" or the parent's SKU. Rows are not guaranteed to be ordered, so
 * parents are collected first and variations attached in a second pass.
 */
export function parseWooCommerceRows(rows: SheetRow[], headers: string[]): ParseResult {
  const warnings: string[] = [];
  const attrs = attributeIndices(headers);
  const materialColumns = headers.filter((h) => isMaterialLabel(h) && !/^attribute \d+ /.test(h));
  const measures = measureColumns(headers);

  const drafts: CandidateDraft[] = [];
  const variableDrafts = new Set<CandidateDraft>();
  const byId = new Map<string, CandidateDraft>();
  const bySku = new Map<string, CandidateDraft>();
  const skippedIds = new Set<string>();
  const skippedSkus = new Set<string>();
  const parentStock = new Map<CandidateDraft, number | null>();
  const usedKeys = new Set<string>();
  const variations: SheetRow[] = [];

  for (const row of rows) {
    const tokens = typeTokens(row);
    if (tokens.includes('variation')) {
      variations.push(row);
      continue;
    }
    const skip = skipReason(tokens);
    if (skip) {
      const name = cell(row, 'Name');
      warnings.push(`Row ${row.rowNumber} skipped: ${skip.named && name ? `"${name}" — ` : ''}${skip.text}`);
      if (cell(row, 'ID')) skippedIds.add(cell(row, 'ID'));
      if (cell(row, 'SKU')) skippedSkus.add(cell(row, 'SKU'));
      continue;
    }

    const id = cell(row, 'ID');
    const sku = cell(row, 'SKU');
    const name = cell(row, 'Name');
    if (!id && !sku && !name) {
      warnings.push(`Row ${row.rowNumber} skipped: no ID, SKU or Name`);
      continue;
    }

    const draft = newDraft(uniqueKey(id || sku || `row-${row.rowNumber}`, usedKeys));
    draft.name = name;
    // Description is preferred over Short description (which is usually a teaser).
    draft.descriptionHtml = cell(row, 'Description') || cell(row, 'Short description');
    draft.imageUrls.push(...splitImages(cell(row, 'Images')));
    // Regular price only — Sale price is intentionally never used.
    draft.rawPrice = cell(row, 'Regular price');
    if (!draft.rawPrice && cell(row, 'Sale price')) {
      draft.issues.push('Only a sale price was found — only the regular price is imported, so add your price before submitting');
    }

    draft.published = readPublished(row);
    draft.weightKg = readWeightKg(row, measures.weight);
    const dims = readDimensions(row, measures);
    draft.dimensions = dims.value;
    if (dims.partial) draft.issues.push('Dimensions incomplete — length, width and height are all needed');
    draft.stock = readStock(row, undefined);
    draft.tags = splitList(cell(row, 'Tags'));
    draft.categoryPath = splitCategories(cell(row, 'Categories'));
    parentStock.set(draft, draft.stock);

    for (const n of attrs) {
      const attrName = cell(row, `Attribute ${n} name`);
      if (attrName && isMaterialLabel(attrName)) draft.materials.push(...splitList(cell(row, `Attribute ${n} value(s)`)));
    }
    for (const column of materialColumns) {
      const value = row.cells[column]?.trim();
      if (value) draft.materials.push(...splitList(value));
    }

    if (tokens.includes('variable')) variableDrafts.add(draft);
    drafts.push(draft);
    if (id) byId.set(id, draft);
    if (sku) bySku.set(sku, draft);
  }

  const variationCount = new Map<CandidateDraft, number>();
  for (const row of variations) {
    const parentRef = cell(row, 'Parent');
    const idMatch = /^id:\s*(\d+)$/i.exec(parentRef);
    const parent = idMatch ? byId.get(idMatch[1]) : (bySku.get(parentRef) ?? byId.get(parentRef));
    if (!parent) {
      // Variations of a parent we already warned about skipping aren't reported twice.
      const parentWasSkipped = idMatch
        ? skippedIds.has(idMatch[1])
        : skippedSkus.has(parentRef) || skippedIds.has(parentRef);
      if (!parentWasSkipped) {
        warnings.push(`Row ${row.rowNumber} skipped: variation's parent product "${parentRef || '(blank)'}" isn't in the file`);
      }
      continue;
    }

    const options: [string, string][] = [];
    for (const n of attrs) {
      const attrName = cell(row, `Attribute ${n} name`);
      const value = cell(row, `Attribute ${n} value(s)`);
      if (attrName && value) {
        options.push([attrName, value]);
        if (isMaterialLabel(attrName)) parent.materials.push(value);
      }
    }
    parent.variants.push({
      name: options.map(([, v]) => v).join(' / ') || cell(row, 'Name'),
      options,
      sku: cell(row, 'SKU'),
      rawPrice: cell(row, 'Regular price'),
      stock: readStock(row, parentStock.get(parent)),
      weightKg: readWeightKg(row, measures.weight),
      dimensions: readDimensions(row, measures).value,
    });
    parent.imageUrls.push(...splitImages(cell(row, 'Images')));
    variationCount.set(parent, (variationCount.get(parent) ?? 0) + 1);
  }

  for (const draft of variableDrafts) {
    if (!variationCount.has(draft)) draft.issues.push('Variable product has no variations in this file');
  }

  return { products: drafts.map(finalizeCandidate), warnings };
}
