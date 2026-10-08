import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { AppError } from '../../../utils/errors';
import { SheetData, SheetRow, SpreadsheetKind } from '../product-import.types';
import { IMPORT_LIMITS, normalizeHeader } from './shared';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((b, i) => buffer[i] === b);
}

/** Decodes CSV bytes: UTF-8 (with or without BOM) or UTF-16 LE/BE (Excel's
 *  "Unicode Text" / some "CSV UTF-16" saves). */
function decodeText(buffer: Buffer): string {
  if (startsWith(buffer, [0xff, 0xfe])) return buffer.subarray(2).toString('utf16le');
  if (startsWith(buffer, [0xfe, 0xff])) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

/** Turns a 2-D grid (first non-empty row = headers) into keyed rows. */
function gridToSheet(grid: string[][], firstRowNumber: number[], warnings: string[]): SheetData {
  const headerIndex = grid.findIndex((r) => r.some((c) => c.trim() !== ''));
  if (headerIndex === -1) return { headers: [], rows: [], warnings };

  const headers = grid[headerIndex].map(normalizeHeader);
  const rows: SheetRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const values = grid[i];
    if (!values.some((c) => c.trim() !== '')) continue;
    const cells: Record<string, string> = {};
    headers.forEach((header, col) => {
      // Duplicate headers: the first non-empty value wins.
      if (header && !cells[header]) cells[header] = values[col] ?? '';
    });
    rows.push({ rowNumber: firstRowNumber[i], cells });
  }
  if (rows.length > IMPORT_LIMITS.maxRowsPerFile) {
    throw AppError.unprocessable(`The file has too many rows — the maximum is ${IMPORT_LIMITS.maxRowsPerFile}`);
  }
  return { headers, rows, warnings };
}

export function readCsv(buffer: Buffer): SheetData {
  if (startsWith(buffer, ZIP_MAGIC)) {
    throw AppError.badRequest('This looks like an Excel workbook — save it with a .xlsx extension, or export it as CSV');
  }
  const text = decodeText(buffer);
  // No explicit delimiter: Papa auto-detects "," vs ";" (Excel in many locales saves
  // CSV with semicolons). Quoted multi-line cells (Shopify Body HTML) are handled.
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  const warnings: string[] = [];
  const quoteErrors = result.errors.filter((e) => e.type === 'Quotes');
  if (quoteErrors.length > 0) {
    warnings.push(
      `The file has ${quoteErrors.length} malformed quoted cell(s) near row ${(quoteErrors[0].row ?? 0) + 1} — check those products carefully`,
    );
  }
  // Papa reports 0-based data indices; since skipEmptyLines drops blank lines the
  // index is a close-enough row hint, +1 for Excel's 1-based numbering.
  const rowNumbers = result.data.map((_, i) => i + 1);
  const grid = result.data.map((r) => r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))));
  return gridToSheet(grid, rowNumbers, warnings);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Converts any exceljs cell value (rich text, hyperlink, formula, date…) to plain text. */
export function cellValueToString(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    // Integers (e.g. numeric SKUs) without exponent notation; decimals as-is.
    return Number.isInteger(value) && Math.abs(value) < 1e21 ? value.toFixed(0) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (isRecord(value)) {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part: unknown) => (isRecord(part) && typeof part.text === 'string' ? part.text : '')).join('');
    }
    if ('hyperlink' in value) {
      return typeof value.text === 'string' && value.text ? value.text : String(value.hyperlink ?? '');
    }
    if ('result' in value || 'formula' in value || 'sharedFormula' in value) {
      return cellValueToString(value.result as ExcelJS.CellValue | undefined);
    }
    // { error: '#N/A' } and anything unrecognised.
    return '';
  }
  return '';
}

export async function readXlsx(buffer: Buffer): Promise<SheetData> {
  if (!startsWith(buffer, ZIP_MAGIC)) {
    throw AppError.badRequest('This file is not a valid .xlsx workbook');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw AppError.badRequest('Could not read this .xlsx workbook — try exporting it as CSV instead');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [], warnings: [] };

  const warnings: string[] = [];
  if (workbook.worksheets.length > 1) warnings.push(`Only the first sheet ("${sheet.name}") was read`);
  if (sheet.rowCount > IMPORT_LIMITS.maxRowsPerFile + 1) {
    throw AppError.unprocessable(`The file has too many rows — the maximum is ${IMPORT_LIMITS.maxRowsPerFile}`);
  }

  const grid: string[][] = [];
  const rowNumbers: number[] = [];
  const columnCount = sheet.columnCount;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    for (let col = 1; col <= columnCount; col += 1) values.push(cellValueToString(row.getCell(col).value));
    grid.push(values);
    rowNumbers.push(rowNumber);
  });
  return gridToSheet(grid, rowNumbers, warnings);
}

export async function readSpreadsheet(buffer: Buffer, kind: SpreadsheetKind): Promise<SheetData> {
  return kind === 'xlsx' ? readXlsx(buffer) : readCsv(buffer);
}
