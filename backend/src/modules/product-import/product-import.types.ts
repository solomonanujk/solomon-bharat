import type { SpreadsheetKind } from '../../middleware/upload';

export type ProductImportSource = 'shopify' | 'woocommerce';

export interface ImportCandidateVariant {
  name: string;
  options: Record<string, string>;
  sku: string | null;
  /** The seller's own store price from the file — becomes sellerPrice (never adminPrice). */
  sellerPrice: number | null;
  /** Declared stock for this variant (WooCommerce Stock). Absent/null = not stated in the file. */
  stock?: number | null;
  weightKg?: number | null;
  /** Per-variant size. `unit` is 'in' only when the file said inches; everything else is converted to cm. */
  dimensions?: ImportDimensions | null;
}

export interface ImportDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export type ImportPublishedState = 'published' | 'private' | 'draft';

export interface SuggestedCategory {
  id: string;
  name: string;
  /** e.g. "Textiles > Bathrobes > Baby" */
  path: string;
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
  /** WooCommerce Published: 1 = published, 0 = private, -1 = draft. */
  published?: ImportPublishedState | null;
  /** Kilograms. For products with variations: the first variation that has a weight. */
  weightKg?: number | null;
  /** "L x W x H cm" or "L x W x H in". */
  dimensions?: string | null;
  /** Declared stock (sum of variation stocks for products with variations). */
  stock?: number | null;
  tags?: string[];
  /** Each WooCommerce Categories entry split on ">" and trimmed. */
  categoryPath?: string[][];
  /** Filled by the preview from the active category tree. */
  suggestedCategory?: SuggestedCategory | null;
  /** Client-chosen level-3 category for this product (validated on import). */
  categoryId?: string | null;
}

export interface ProductImportPreview {
  source: ProductImportSource;
  products: ImportCandidate[];
  warnings: string[];
}

export interface ImportProductsInput {
  /** Fallback for products without their own categoryId. */
  categoryId?: string;
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
