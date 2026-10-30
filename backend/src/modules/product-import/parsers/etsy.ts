import { ImportCandidate, ParseResult, SheetRow } from '../product-import.types';
import { cell, CandidateDraft, finalizeCandidate, newDraft, IMPORT_LIMITS } from './shared';

/** Detect Etsy format: has 'currency_code' column (unique to Etsy exports). */
export function isEtsyHeaderSet(headers: string[]): boolean {
  const set = new Set(headers);
  return set.has('currency_code') && set.has('title') && set.has('price');
}

/** Cartesian product of arrays. */
function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])), [[]]);
}

export function parseEtsyRows(rows: SheetRow[]): ParseResult {
  const warnings: string[] = [];
  const products: ImportCandidate[] = [];
  const usedKeys = new Set<string>();

  for (const row of rows) {
    const title = cell(row, 'TITLE');
    if (!title) {
      warnings.push(`Row ${row.rowNumber} skipped: no TITLE`);
      continue;
    }
    if (products.length >= IMPORT_LIMITS.maxProductsPerFile) {
      warnings.push(
        `Stopped at row ${row.rowNumber}: file exceeds ${IMPORT_LIMITS.maxProductsPerFile} products per import`,
      );
      break;
    }

    // Unique key from row number
    const baseKey = String(row.rowNumber);
    let key = baseKey;
    let n = 2;
    while (usedKeys.has(key)) { key = `${baseKey}-${n}`; n++; }
    usedKeys.add(key);

    const draft: CandidateDraft = newDraft(key);
    draft.name = title;
    draft.descriptionHtml = cell(row, 'DESCRIPTION');
    draft.rawPrice = cell(row, 'PRICE');

    // Stock
    const qty = parseInt(cell(row, 'QUANTITY'), 10);
    if (!isNaN(qty) && qty >= 0) draft.stock = qty;

    // Tags
    const tagsRaw = cell(row, 'TAGS');
    if (tagsRaw) {
      draft.tags = tagsRaw.split(',').map((t) => t.trim().replace(/_/g, ' ')).filter(Boolean);
    }

    // Materials
    const materials = cell(row, 'MATERIALS');
    if (materials) draft.materials = [materials];

    // Images IMAGE1..IMAGE10
    for (let i = 1; i <= 10; i++) {
      const url = cell(row, `IMAGE${i}`);
      if (url) draft.imageUrls.push(url);
    }

    // Variations — up to 3
    const varDefs: { name: string; values: string[] }[] = [];
    for (let i = 1; i <= 3; i++) {
      const varName = cell(row, `VARIATION ${i} NAME`);
      const varValues = cell(row, `VARIATION ${i} VALUES`);
      if (varName && varValues) {
        const values = varValues.split(',').map((v) => v.trim()).filter(Boolean);
        if (values.length) varDefs.push({ name: varName, values });
      }
    }

    const productRawPrice = cell(row, 'PRICE');
    const sku = cell(row, 'SKU');

    if (varDefs.length > 0) {
      // Generate all combinations
      const combos = cartesian(varDefs.map((vd) => vd.values));
      for (let ci = 0; ci < combos.length && draft.variants.length < IMPORT_LIMITS.variantsPerProduct; ci++) {
        const combo = combos[ci];
        const options: [string, string][] = varDefs.map((vd, idx) => [vd.name, combo[idx]]);
        const variantSku = sku ? (combos.length === 1 ? sku : `${sku}-${ci + 1}`) : '';
        draft.variants.push({ name: combo.join(' / '), options, sku: variantSku, rawPrice: productRawPrice });
      }
      if (combos.length > IMPORT_LIMITS.variantsPerProduct) {
        draft.issues.push(`Only the first ${IMPORT_LIMITS.variantsPerProduct} of ${combos.length} variants will be imported`);
      }
    }

    products.push(finalizeCandidate(draft));
  }

  return { products, warnings };
}
