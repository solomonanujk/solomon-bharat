import type { SpreadsheetKind } from '../../middleware/upload';

export type ProductImportSource = 'shopify' | 'woocommerce';

export interface ImportCandidateVariant {
  name: string;
  options: Record<string, string>;
  sku: string | null;
  /** The seller's own store price from the file — becomes sellerPrice (never adminPrice). */
  sellerPrice: number | null;
}

/** One product parsed from an uploaded export. Nothing is persisted at preview time. */
export interface ImportCandidate {
  /** Stable id within the file: Shopify Handle, or WooCommerce ID / SKU / row. */
  key: string;
  name: string;
  /** Plain text — HTML is stripped from Body (HTML) / Description. */
  description: string | null;
  imageUrls: string[];
  /** Cheapest variant price, or the simple product's price. */
  sellerPrice: number | null;
  /** Empty for single-variant products. */
  variants: ImportCandidateVariant[];
  /** Only filled when a material-like column/option exists. */
  materials: string | null;
  /** Human-readable, non-blocking per-product problems. */
  issues: string[];
}

export interface ProductImportPreview {
  source: ProductImportSource;
  products: ImportCandidate[];
  warnings: string[];
}

export interface ImportProductsInput {
  categoryId: string;
  products: ImportCandidate[];
}

export interface ProductImportResult {
  created: { id: string; name: string; slug: string }[];
  failed: { key: string; name: string; error: string }[];
}

/** The uploaded spreadsheet as the service receives it from the controller. */
export interface SpreadsheetFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export type { SpreadsheetKind };

// ─── Parser internals ────────────────────────────────────────────────────────

/** One spreadsheet data row. `cells` is keyed by normalized header (see normalizeHeader). */
export interface SheetRow {
  /** 1-based row number as the user sees it in Excel (header row = 1). */
  rowNumber: number;
  cells: Record<string, string>;
}

export interface SheetData {
  /** Normalized headers, in column order. */
  headers: string[];
  rows: SheetRow[];
  warnings: string[];
}

export interface ParseResult {
  products: ImportCandidate[];
  warnings: string[];
}
