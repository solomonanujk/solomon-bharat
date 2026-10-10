import { ParseResult, SheetRow } from '../product-import.types';
import { CandidateDraft, cell, finalizeCandidate, isMaterialLabel, newDraft, normalizeHeader } from './shared';
import {
  cellAny,
  DIMENSIONS_INCOMPLETE_ISSUE,
  readShopifyDimensions,
  readShopifyPublished,
  readShopifyStock,
  readShopifyWeightKg,
  SHOPIFY_COLUMNS as COL,
  splitShopifyCategory,
  splitShopifyTags,
} from './shopify-fields';

const OPTION_COUNT = 3;

function hasAny(set: Set<string>, aliases: readonly string[]): boolean {
  return aliases.some((a) => set.has(normalizeHeader(a)));
}

/** Shopify's product CSV always has Handle (or "URL handle") + Title; a price, SKU or
 *  description column tells it apart from an arbitrary sheet that happens to have a "Title"
 *  column. WooCommerce exports have Type + Name and no Title/Handle, so they never match. */
export function isShopifyHeaderSet(headers: string[]): boolean {
  const set = new Set(headers);
  return (
    hasAny(set, COL.handle) &&
    hasAny(set, COL.title) &&
    (hasAny(set, COL.price) || hasAny(set, COL.body) || hasAny(set, COL.sku))
  );
}

function isVariantRow(row: SheetRow): boolean {
  if (cellAny(row, COL.sku) || cellAny(row, COL.price)) return true;
  for (let i = 1; i <= OPTION_COUNT; i += 1) {
    if (cell(row, `Option${i} Value`)) return true;
  }
  return false;
}

interface ShopifyGroup {
  draft: CandidateDraft;
  optionNames: string[];
  images: { url: string; position: number; order: number }[];
  variantImages: string[];
  /** Status/Published/category/tags are read from the first row that carries a Title. */
  productRowSeen: boolean;
  variantKeys: Set<string>;
  duplicateVariants: number;
  dimensionsPartial: boolean;
}

/**
 * Shopify product CSV (legacy or current header names): one row per variant and/or image,
 * all rows of a product sharing its Handle. The first row carries Title/Body/Option names;
 * later rows add variants (Option values, SKU, price) and/or extra images.
 * Vendor (supplier identity), cost, compare-at, SEO, Google Shopping, barcodes, collections
 * and market-specific price columns are intentionally never read.
 */
export function parseShopifyRows(rows: SheetRow[], headers: string[]): ParseResult {
  const warnings: string[] = [];
  const groups = new Map<string, ShopifyGroup>();
  const materialColumns = headers.filter(isMaterialLabel);
  let imageOrder = 0;

  for (const row of rows) {
    const handle = cellAny(row, COL.handle);
    if (!handle) {
      warnings.push(`Row ${row.rowNumber} skipped: no Handle`);
      continue;
    }

    let group = groups.get(handle);
    if (!group) {
      // A stray note line (e.g. "Note: Red column is required"): the Handle is its only cell.
      const onlyHandle = Object.values(row.cells).filter((v) => v.trim() !== '').length <= 1;
      if (onlyHandle) {
        warnings.push(`Row ${row.rowNumber} ignored: it has a handle but no product data`);
        continue;
      }
      group = {
        draft: newDraft(handle),
        optionNames: [],
        images: [],
        variantImages: [],
        productRowSeen: false,
        variantKeys: new Set(),
        duplicateVariants: 0,
        dimensionsPartial: false,
      };
      groups.set(handle, group);
    }
    const { draft } = group;

    const title = cellAny(row, COL.title);
    if (!draft.name) draft.name = title;
    if (!draft.descriptionHtml) draft.descriptionHtml = cellAny(row, COL.body);
    for (let i = 1; i <= OPTION_COUNT; i += 1) {
      const name = cell(row, `Option${i} Name`);
      if (name && !group.optionNames[i - 1]) group.optionNames[i - 1] = name;
    }

    if (title && !group.productRowSeen) {
      group.productRowSeen = true;
      const status = cellAny(row, COL.status);
      if (status.toLowerCase() === 'archived') draft.issues.push('Archived in Shopify');
      const published = readShopifyPublished(status, cellAny(row, COL.published));
      if (published) draft.published = published;
      draft.tags = splitShopifyTags(cellAny(row, COL.tags));
      const paths: string[][] = [];
      const category = splitShopifyCategory(cellAny(row, COL.category));
      if (category.length) paths.push(category);
      const type = cellAny(row, COL.type);
      if (type) paths.push([type]);
      draft.categoryPath = paths;
    }

    const imageSrc = cellAny(row, COL.imageSrc);
    if (imageSrc) {
      const position = Number(cellAny(row, COL.imagePosition));
      group.images.push({
        url: imageSrc,
        position: Number.isFinite(position) && position > 0 ? position : Number.MAX_SAFE_INTEGER,
        order: (imageOrder += 1),
      });
    }
    const variantImage = cellAny(row, COL.variantImage);
    if (variantImage) group.variantImages.push(variantImage);

    for (const column of materialColumns) {
      const value = row.cells[column]?.trim();
      if (value) draft.materials.push(...value.split(/\s*;\s*/));
    }

    const dims = readShopifyDimensions(row);
    if (dims.partial) group.dimensionsPartial = true;
    if (dims.value && !draft.dimensions) draft.dimensions = dims.value;

    // Image-only rows (just Handle + Image Src/Position) aren't variants.
    if (isVariantRow(row)) {
      const options: [string, string][] = [];
      for (let i = 1; i <= OPTION_COUNT; i += 1) {
        const value = cell(row, `Option${i} Value`);
        const optName = group.optionNames[i - 1] || `Option ${i}`;
        if (value) options.push([optName, value]);
        if (value && isMaterialLabel(optName)) draft.materials.push(value);
      }
      const sku = cellAny(row, COL.sku);
      const variantKey = `${options.map(([, v]) => v).join('\u0001')}\u0000${sku}`;
      if (group.variantKeys.has(variantKey)) {
        group.duplicateVariants += 1;
        continue;
      }
      group.variantKeys.add(variantKey);
      draft.variants.push({
        name: options.map(([, v]) => v).join(' / '),
        options,
        sku,
        rawPrice: cellAny(row, COL.price),
        stock: readShopifyStock(row),
        weightKg: readShopifyWeightKg(row),
        dimensions: dims.value,
      });
    }
  }

  const products = [...groups.values()].map((group) => {
    const ordered = [...group.images].sort((a, b) => a.position - b.position || a.order - b.order).map((i) => i.url);
    group.draft.imageUrls = [...ordered, ...group.variantImages];
    if (group.duplicateVariants > 0) {
      group.draft.issues.push(`Removed ${group.duplicateVariants} duplicate variant row(s)`);
    }
    if (group.dimensionsPartial && !group.draft.dimensions) group.draft.issues.push(DIMENSIONS_INCOMPLETE_ISSUE);
    return finalizeCandidate(group.draft);
  });

  return { products, warnings };
}
