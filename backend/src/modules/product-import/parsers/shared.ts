import {
  ImportCandidate,
  ImportCandidateVariant,
  ImportDimensions,
  ImportPublishedState,
  SheetRow,
} from '../product-import.types';

/**
 * Field caps. These mirror the products module's own Zod limits (products.validation.ts)
 * so an imported draft can later be edited and submitted by the seller without the
 * existing form rejecting a field the import let through.
 */
export const IMPORT_LIMITS = {
  key: 200,
  name: 60,
  description: 1000,
  materials: 500,
  optionName: 50,
  optionValue: 100,
  optionsPerVariant: 10,
  variantName: 100,
  sku: 100,
  imageUrl: 2048,
  imagesPerProduct: 10,
  variantsPerProduct: 100,
  maxProductsPerFile: 1000,
  maxRowsPerFile: 50_000,
  /** Product.sellerPrice is Decimal(12,2). */
  maxPrice: 99_999_999,
  /** Product.weight is validated as a positive number of kg. */
  maxWeightKg: 100_000,
  /** One side of a package, in cm or inches. */
  maxDimension: 100_000,
  /** Declared stock / variant inventory is an Int column. */
  maxStock: 10_000_000,
  /** products.validation.ts: tags are 1–50 chars. */
  tags: 20,
  tagLength: 50,
  /** Categories entries kept per product, and path depth / segment length. */
  categoryPaths: 10,
  categoryPathDepth: 6,
  categorySegment: 100,
} as const;

export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Reads a cell by its (un-normalized) header name. Missing column → ''. */
export function cell(row: SheetRow, header: string): string {
  return (row.cells[normalizeHeader(header)] ?? '').trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  middot: '·',
  times: '×',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Store descriptions are HTML; this platform's description is plain text. Keeps
 *  paragraph/line breaks, drops every tag (and script/style bodies entirely). */
export function stripHtml(html: string): string {
  // Inside real HTML a raw newline is just whitespace; in a plain-text cell it's a line break.
  const isHtml = /<\/?[a-z][^>]*>/i.test(html);
  const text = (isHtml ? html.replace(/\r?\n/g, ' ') : html)
    // WooCommerce exports escape newlines inside cells as a literal "\n".
    .replace(/\\n/g, '\n')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses a store price. Tolerates currency symbols/codes and the thousands/decimal
 * separators Excel adds when a CSV is round-tripped through it ("₹1,299.00",
 * "1.299,50", "$ 12"). Returns null for blank, non-numeric, zero or negative values.
 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  // Excel scientific notation for a numeric cell, e.g. "1.2E+05".
  if (/^\s*\d+(\.\d+)?e[+-]?\d+\s*$/i.test(raw)) return roundPrice(Number(raw));
  let s = raw.trim().replace(/[^\d.,-]/g, '');
  if (!s || s.startsWith('-')) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator comes last is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // "12,50" → decimal comma; "1,299" / "1,29,999" → thousands separators.
    const decimals = s.length - lastComma - 1;
    s = decimals === 2 && s.indexOf(',') === lastComma ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return roundPrice(Number(s));
}

function roundPrice(n: number): number | null {
  const value = Math.round(n * 100) / 100;
  if (!Number.isFinite(value) || value <= 0 || value > IMPORT_LIMITS.maxPrice) return null;
  return value;
}

/**
 * Parses a plain non-negative quantity such as a weight or a dimension: "1.5", "1,5",
 * "1,250.75", "12 kg". Returns null for blank or non-numeric text.
 */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[^\d.,-]/g, '');
  if (!s || s.startsWith('-')) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // "1,5" / "0,25" → decimal comma; "1,000" / "1,29,999" → thousands separators.
    const decimals = s.length - lastComma - 1;
    s = s.indexOf(',') === lastComma && decimals !== 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isHttpUrl(value: string): boolean {
  if (value.length > IMPORT_LIMITS.imageUrl) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Material-like header/option names: "Material", "Materials", "Fabric",
 *  Shopify's "Material (product.metafields.shopify.material)", WooCommerce "Meta: material". */
export function isMaterialLabel(label: string): boolean {
  return /\b(materials?|fabrics?)\b/i.test(label);
}

/** Accumulated per-product data before limits/normalization are applied. */
export interface CandidateDraft {
  key: string;
  name: string;
  descriptionHtml: string;
  /** Raw, in display order — validated, deduped and capped in finalizeCandidate. */
  imageUrls: string[];
  variants: {
    name: string;
    options: [string, string][];
    sku: string;
    rawPrice: string;
    /** Declared stock; null/absent = not stated in the file. */
    stock?: number | null;
    weightKg?: number | null;
    dimensions?: ImportDimensions | null;
  }[];
  /** Product-level price (WooCommerce simple products). */
  rawPrice: string;
  materials: string[];
  issues: string[];
  published?: ImportPublishedState | null;
  weightKg?: number | null;
  dimensions?: ImportDimensions | null;
  stock?: number | null;
  tags?: string[];
  categoryPath?: string[][];
}

export function formatDimensions(d: ImportDimensions): string {
  return `${d.length} x ${d.width} x ${d.height} ${d.unit}`;
}

export function newDraft(key: string): CandidateDraft {
  return { key, name: '', descriptionHtml: '', imageUrls: [], variants: [], rawPrice: '', materials: [], issues: [] };
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

/** Applies limits, dedupes, picks the seller price and records per-product issues. */
export function finalizeCandidate(draft: CandidateDraft): ImportCandidate {
  const issues = [...draft.issues];
  const key = truncate(draft.key, IMPORT_LIMITS.key);

  let name = draft.name.trim();
  if (!name) {
    name = key;
    issues.push(`No product name in the file — using "${key}"`);
  }
  if (name.length > IMPORT_LIMITS.name) {
    name = truncate(name, IMPORT_LIMITS.name);
    issues.push(`Name shortened to ${IMPORT_LIMITS.name} characters`);
  }

  let description: string | null = stripHtml(draft.descriptionHtml) || null;
  if (description && description.length > IMPORT_LIMITS.description) {
    description = truncate(description, IMPORT_LIMITS.description);
    issues.push(`Description shortened to ${IMPORT_LIMITS.description} characters`);
  }
  if (!description) issues.push('No description');

  // Images
  const seen = new Set<string>();
  let invalidImages = 0;
  const validImages: string[] = [];
  for (const raw of draft.imageUrls) {
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (!isHttpUrl(url)) {
      invalidImages += 1;
      continue;
    }
    validImages.push(url);
  }
  if (invalidImages > 0) issues.push(`Skipped ${invalidImages} image link(s) that aren't valid web addresses`);
  if (validImages.length > IMPORT_LIMITS.imagesPerProduct) {
    issues.push(`Only the first ${IMPORT_LIMITS.imagesPerProduct} of ${validImages.length} images will be imported`);
  }
  const imageUrls = validImages.slice(0, IMPORT_LIMITS.imagesPerProduct);
  if (imageUrls.length === 0) issues.push('No images');
  else if (imageUrls.length < 2) issues.push('Fewer than 2 images');

  // Variants
  let rawVariants = draft.variants;
  if (rawVariants.length > IMPORT_LIMITS.variantsPerProduct) {
    issues.push(`Only the first ${IMPORT_LIMITS.variantsPerProduct} of ${rawVariants.length} variants will be imported`);
    rawVariants = rawVariants.slice(0, IMPORT_LIMITS.variantsPerProduct);
  }

  let sellerPrice: number | null;
  let variants: ImportCandidateVariant[] = [];

  if (rawVariants.length <= 1) {
    sellerPrice = parsePrice(rawVariants[0]?.rawPrice) ?? parsePrice(draft.rawPrice);
  } else {
    const usedSkus = new Set<string>();
    let droppedSkus = 0;
    let unpriced = 0;
    variants = rawVariants.map((v) => {
      const options: Record<string, string> = {};
      for (const [rawName, rawValue] of v.options.slice(0, IMPORT_LIMITS.optionsPerVariant)) {
        const optName = truncate(rawName.trim(), IMPORT_LIMITS.optionName);
        const optValue = truncate(rawValue.trim(), IMPORT_LIMITS.optionValue);
        if (optName && optValue && !(optName in options)) options[optName] = optValue;
      }
      const label = Object.values(options).join(' / ') || v.name.trim() || 'Default';
      let sku: string | null = v.sku.trim() || null;
      if (sku && (sku.length > IMPORT_LIMITS.sku || usedSkus.has(sku))) {
        sku = null;
        droppedSkus += 1;
      }
      if (sku) usedSkus.add(sku);
      const price = parsePrice(v.rawPrice);
      if (price === null) unpriced += 1;
      const out: ImportCandidateVariant = { name: truncate(label, IMPORT_LIMITS.variantName), options, sku, sellerPrice: price };
      if (v.stock != null) out.stock = v.stock;
      if (v.weightKg != null) out.weightKg = v.weightKg;
      if (v.dimensions) out.dimensions = v.dimensions;
      return out;
    });
    if (droppedSkus > 0) issues.push(`Removed ${droppedSkus} duplicate or over-long variant SKU(s)`);
    if (unpriced > 0) issues.push(`${unpriced} variant(s) have no price`);
    const prices = variants.map((v) => v.sellerPrice).filter((p): p is number => p !== null);
    sellerPrice = prices.length ? Math.min(...prices) : null;
  }
  if (sellerPrice === null) issues.push('No price found');

  const uniqueMaterials = [...new Set(draft.materials.map((m) => m.trim()).filter(Boolean))];
  const materials = uniqueMaterials.length ? truncate(uniqueMaterials.join(', '), IMPORT_LIMITS.materials) : null;

  // Product-level weight / size / stock. With 2+ variants (the only case that becomes
  // real variants) weight and size come from the first variant that has one — the same
  // rule as ProductForm.computeBase — and stock is the sum of the variants' stock, like
  // ProductsService.deriveDeclaredStock. With 0–1 variants the lone variation's values win.
  const firstVariant = rawVariants[0];
  const weightKg =
    (rawVariants.length > 1 ? rawVariants.find((v) => v.weightKg != null)?.weightKg : firstVariant?.weightKg) ??
    draft.weightKg ??
    null;
  const dims =
    (rawVariants.length > 1 ? rawVariants.find((v) => v.dimensions)?.dimensions : firstVariant?.dimensions) ??
    draft.dimensions ??
    null;
  let stock: number | null;
  if (rawVariants.length > 1) {
    stock = rawVariants.some((v) => v.stock != null)
      ? Math.min(
          rawVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0),
          IMPORT_LIMITS.maxStock,
        )
      : (draft.stock ?? null);
  } else {
    stock = firstVariant?.stock ?? draft.stock ?? null;
  }
  if (weightKg === null) issues.push('No weight');

  const out: ImportCandidate = { key, name, description, imageUrls, sellerPrice, variants, materials, issues };
  if (weightKg !== null) out.weightKg = weightKg;
  if (dims) out.dimensions = formatDimensions(dims);
  if (stock !== null) out.stock = stock;
  if (draft.published) out.published = draft.published;
  const tags = normalizeTags(draft.tags ?? [], issues);
  if (tags.length) out.tags = tags;
  const categoryPath = normalizeCategoryPaths(draft.categoryPath ?? []);
  if (categoryPath.length) out.categoryPath = categoryPath;
  return out;
}

function normalizeTags(raw: string[], issues: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of raw) {
    const tag = truncate(t.trim(), IMPORT_LIMITS.tagLength);
    const k = tag.toLowerCase();
    if (!tag || seen.has(k)) continue;
    seen.add(k);
    tags.push(tag);
  }
  if (tags.length > IMPORT_LIMITS.tags) {
    issues.push(`Only the first ${IMPORT_LIMITS.tags} of ${tags.length} tags will be imported`);
    return tags.slice(0, IMPORT_LIMITS.tags);
  }
  return tags;
}

function normalizeCategoryPaths(raw: string[][]): string[][] {
  const paths: string[][] = [];
  for (const p of raw) {
    const segments = p
      .map((seg) => truncate(seg.trim(), IMPORT_LIMITS.categorySegment))
      .filter(Boolean)
      .slice(0, IMPORT_LIMITS.categoryPathDepth);
    if (segments.length) paths.push(segments);
  }
  return paths.slice(0, IMPORT_LIMITS.categoryPaths);
}

/** Appends "-2", "-3"… so every candidate key in one file is unique. */
export function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}-${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}
