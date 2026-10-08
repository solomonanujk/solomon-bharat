import { AppError } from '../../../utils/errors';
import { ProductImportPreview, ProductImportSource, SpreadsheetKind } from '../product-import.types';
import { IMPORT_LIMITS } from './shared';
import { readSpreadsheet } from './spreadsheet';
import { isShopifyHeaderSet, parseShopifyRows } from './shopify';
import { isWooCommerceHeaderSet, parseWooCommerceRows } from './woocommerce';

export const UNKNOWN_FORMAT_MESSAGE =
  "We couldn't recognise this file. Upload a Shopify product CSV export (columns like Handle, Title, " +
  'Variant Price) or a WooCommerce product CSV export (columns like ID, Type, SKU, Name, Regular price) — ' +
  'as .csv, or the same export saved as .xlsx in Excel.';

export function detectSource(headers: string[]): ProductImportSource | null {
  if (isShopifyHeaderSet(headers)) return 'shopify';
  if (isWooCommerceHeaderSet(headers)) return 'woocommerce';
  return null;
}

/** Pure parse of an uploaded export into import candidates — no IO besides reading the buffer. */
export async function parseProductSpreadsheet(buffer: Buffer, kind: SpreadsheetKind): Promise<ProductImportPreview> {
  const sheet = await readSpreadsheet(buffer, kind);
  const source = detectSource(sheet.headers);
  if (!source) throw AppError.unprocessable(UNKNOWN_FORMAT_MESSAGE);

  const parsed =
    source === 'shopify' ? parseShopifyRows(sheet.rows, sheet.headers) : parseWooCommerceRows(sheet.rows, sheet.headers);

  if (parsed.products.length === 0) {
    throw AppError.unprocessable('The file contains no products');
  }
  if (parsed.products.length > IMPORT_LIMITS.maxProductsPerFile) {
    throw AppError.unprocessable(
      `The file contains ${parsed.products.length} products — the maximum per file is ${IMPORT_LIMITS.maxProductsPerFile}. Split it into smaller files.`,
    );
  }

  return { source, products: parsed.products, warnings: [...sheet.warnings, ...parsed.warnings] };
}

export { parseShopifyRows } from './shopify';
export { parseWooCommerceRows } from './woocommerce';
export { readCsv, readXlsx, readSpreadsheet } from './spreadsheet';
export { IMPORT_LIMITS, parsePrice, stripHtml, isHttpUrl } from './shared';
