/**
 * CSV writing helpers for admin exports.
 *
 * Three things every export here needs and that naive `join(',')` gets wrong:
 *  - RFC 4180 escaping, so a value containing a comma, a double quote or a newline
 *    (internal notes are multi-line) cannot break the row/column grid.
 *  - A UTF-8 BOM, because Excel on Windows otherwise decodes the file as the local
 *    ANSI codepage and mangles Indian names and the ₹ sign.
 *  - A formula-injection guard: Excel/Sheets evaluate a cell that starts with
 *    `=`, `+`, `-` or `@`, so attacker-controlled applicant text could become a
 *    live formula (`=HYPERLINK(...)`, DDE) in the owner's spreadsheet.
 */

/** The byte-order mark Excel looks for to decode a .csv as UTF-8. */
export const UTF8_BOM = '﻿';

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

/**
 * Renders one value as a CSV field. `null`/`undefined` become empty, dates become
 * ISO-ish `YYYY-MM-DD`, booleans become Yes/No, arrays are semicolon-joined.
 */
export function csvCell(value: unknown): string {
  const raw = stringifyCell(value);
  // Neutralise a spreadsheet formula by prefixing an apostrophe, which Excel and
  // Sheets both read as "the rest of this cell is literal text".
  const guarded = FORMULA_PREFIXES.some((p) => raw.startsWith(p)) ? `'${raw}` : raw;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : toIsoDate(value);
  if (Array.isArray(value)) return value.map((v) => stringifyCell(v)).filter(Boolean).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** `YYYY-MM-DD` in UTC — stable across the server's timezone. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a complete CSV document (BOM + header row + data rows, CRLF line endings
 * as per RFC 4180 so Excel and Notepad both see the row breaks).
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
