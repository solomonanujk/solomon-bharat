import { ParseResult, SheetRow } from '../product-import.types';
import { CandidateDraft, cell, finalizeCandidate, isMaterialLabel, newDraft, normalizeHeader } from './shared';

const OPTION_COUNT = 3;

/** Shopify's product CSV always has Handle + Title; Variant Price / Body (HTML) tell
 *  it apart from an arbitrary sheet that happens to have a "Title" column. */
export function isShopifyHeaderSet(headers: string[]): boolean {
  const set = new Set(headers);
  return (
    set.has(normalizeHeader('Handle')) &&
    set.has(normalizeHeader('Title')) &&
    (set.has(normalizeHeader('Variant Price')) || set.has(normalizeHeader('Body (HTML)')))
  );
}

function isVariantRow(row: SheetRow): boolean {
  if (cell(row, 'Variant SKU') || cell(row, 'Variant Price')) return true;
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
}

/**
 * Shopify product CSV: one row per variant and/or image, all rows of a product
 * sharing its Handle. The first row carries Title/Body/Option names; later rows add
 * variants (Option values, SKU, price) and/or extra images (Image Src + Position).
 */
export function parseShopifyRows(rows: SheetRow[], headers: string[]): ParseResult {
  const warnings: string[] = [];
  const groups = new Map<string, ShopifyGroup>();
  const materialColumns = headers.filter(isMaterialLabel);
  let imageOrder = 0;

  for (const row of rows) {
    const handle = cell(row, 'Handle');
    if (!handle) {
      warnings.push(`Row ${row.rowNumber} skipped: no Handle`);
      continue;
    }

    let group = groups.get(handle);
    if (!group) {
      group = { draft: newDraft(handle), optionNames: [], images: [], variantImages: [] };
      groups.set(handle, group);
    }
    const { draft } = group;

    if (!draft.name) draft.name = cell(row, 'Title');
    if (!draft.descriptionHtml) draft.descriptionHtml = cell(row, 'Body (HTML)');
    for (let i = 1; i <= OPTION_COUNT; i += 1) {
      const name = cell(row, `Option${i} Name`);
      if (name && !group.optionNames[i - 1]) group.optionNames[i - 1] = name;
    }
    if (cell(row, 'Title') && cell(row, 'Status').toLowerCase() === 'archived') {
      draft.issues.push('Archived in Shopify');
    }

    const imageSrc = cell(row, 'Image Src');
    if (imageSrc) {
      const position = Number(cell(row, 'Image Position'));
      group.images.push({
        url: imageSrc,
        position: Number.isFinite(position) && position > 0 ? position : Number.MAX_SAFE_INTEGER,
        order: (imageOrder += 1),
      });
    }
    const variantImage = cell(row, 'Variant Image');
    if (variantImage) group.variantImages.push(variantImage);

    for (const column of materialColumns) {
      const value = row.cells[column]?.trim();
      if (value) draft.materials.push(...value.split(/\s*;\s*/));
    }

    // Image-only rows (just Handle + Image Src/Position) aren't variants.
    if (isVariantRow(row)) {
      const options: [string, string][] = [];
      for (let i = 1; i <= OPTION_COUNT; i += 1) {
        const value = cell(row, `Option${i} Value`);
        const optName = group.optionNames[i - 1] || `Option ${i}`;
        if (value) options.push([optName, value]);
        if (value && isMaterialLabel(optName)) draft.materials.push(value);
      }
      draft.variants.push({
        name: options.map(([, v]) => v).join(' / '),
        options,
        sku: cell(row, 'Variant SKU'),
        rawPrice: cell(row, 'Variant Price'),
      });
    }
  }

  const products = [...groups.values()].map((group) => {
    const ordered = [...group.images].sort((a, b) => a.position - b.position || a.order - b.order).map((i) => i.url);
    group.draft.imageUrls = [...ordered, ...group.variantImages];
    return finalizeCandidate(group.draft);
  });

  return { products, warnings };
}
