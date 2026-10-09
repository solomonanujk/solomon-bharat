import { ParseResult, SheetRow } from '../product-import.types';
import { CandidateDraft, cell, finalizeCandidate, isMaterialLabel, newDraft, normalizeHeader, uniqueKey } from './shared';

/** WooCommerce's built-in product CSV exporter (Products → Export). */
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

  const drafts: CandidateDraft[] = [];
  const variableDrafts = new Set<CandidateDraft>();
  const byId = new Map<string, CandidateDraft>();
  const bySku = new Map<string, CandidateDraft>();
  const usedKeys = new Set<string>();
  const variations: SheetRow[] = [];

  for (const row of rows) {
    const type = cell(row, 'Type').toLowerCase();
    if (type.includes('variation')) {
      variations.push(row);
      continue;
    }
    if (type.includes('grouped') || type.includes('external')) {
      warnings.push(`Row ${row.rowNumber} skipped: ${type.includes('grouped') ? 'grouped' : 'external/affiliate'} products can't be imported`);
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
    draft.descriptionHtml = cell(row, 'Description') || cell(row, 'Short description');
    draft.imageUrls.push(...splitList(cell(row, 'Images')));
    draft.rawPrice = cell(row, 'Regular price');
    if (!draft.rawPrice && cell(row, 'Sale price')) {
      draft.issues.push('Only a sale price was found — only the regular price is imported, so add your price before submitting');
    }

    for (const n of attrs) {
      const attrName = cell(row, `Attribute ${n} name`);
      if (attrName && isMaterialLabel(attrName)) draft.materials.push(...splitList(cell(row, `Attribute ${n} value(s)`)));
    }
    for (const column of materialColumns) {
      const value = row.cells[column]?.trim();
      if (value) draft.materials.push(...splitList(value));
    }

    if (type.includes('variable')) variableDrafts.add(draft);
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
      warnings.push(`Row ${row.rowNumber} skipped: variation's parent product "${parentRef || '(blank)'}" isn't in the file`);
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
    });
    parent.imageUrls.push(...splitList(cell(row, 'Images')));
    variationCount.set(parent, (variationCount.get(parent) ?? 0) + 1);
  }

  for (const draft of variableDrafts) {
    if (!variationCount.has(draft)) draft.issues.push('Variable product has no variations in this file');
  }

  return { products: drafts.map(finalizeCandidate), warnings };
}
