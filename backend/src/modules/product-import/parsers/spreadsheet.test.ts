import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { AppError } from '../../../utils/errors';
import { cellValueToString, readCsv, readXlsx } from './spreadsheet';
import { detectSource, parseProductSpreadsheet, UNKNOWN_FORMAT_MESSAGE } from './index';

async function buildXlsx(rows: ExcelJS.CellValue[][], extraSheet = false): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  rows.forEach((r) => sheet.addRow(r));
  if (extraSheet) workbook.addWorksheet('Notes').addRow(['ignored']);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

describe('spreadsheet reader', () => {
  it('xlsx round-trip: a Shopify export saved in Excel (numeric prices, rich text, hyperlink)', async () => {
    const buffer = await buildXlsx(
      [
        ['Handle', 'Title', 'Body (HTML)', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Price', 'Image Src', 'Image Position'],
        ['shawl', { richText: [{ text: 'Pashmina ' }, { text: 'Shawl' }] }, '<p>Warm</p>', 'Color', 'Grey', 123456789012, 2499.5, { text: 'https://cdn.shopify.com/s.jpg', hyperlink: 'https://cdn.shopify.com/s.jpg' }, 1],
        ['shawl', null, null, null, 'Cream', 'SH-CR', { formula: 'A1', result: 2100 }, null, null],
      ],
      true,
    );

    const preview = await parseProductSpreadsheet(buffer, 'xlsx');
    expect(preview.source).toBe('shopify');
    expect(preview.warnings).toEqual(['Only the first sheet ("Products") was read']);
    const [p] = preview.products;
    expect(p.name).toBe('Pashmina Shawl');
    expect(p.description).toBe('Warm');
    expect(p.imageUrls).toEqual(['https://cdn.shopify.com/s.jpg']);
    expect(p.variants).toEqual([
      { name: 'Grey', options: { Color: 'Grey' }, sku: '123456789012', sellerPrice: 2499.5 },
      { name: 'Cream', options: { Color: 'Cream' }, sku: 'SH-CR', sellerPrice: 2100 },
    ]);
    expect(p.sellerPrice).toBe(2100);
  });

  it('xlsx round-trip: a WooCommerce export', async () => {
    const buffer = await buildXlsx([
      ['ID', 'Type', 'SKU', 'Name', 'Description', 'Regular price', 'Images'],
      [7, 'simple', 'DIYA', 'Brass Diya', 'Lamp', 350, 'https://shop.test/d.jpg'],
    ]);
    const preview = await parseProductSpreadsheet(buffer, 'xlsx');
    expect(preview.source).toBe('woocommerce');
    expect(preview.products[0]).toMatchObject({ key: '7', name: 'Brass Diya', sellerPrice: 350 });
  });

  it('rejects an unknown header set with 422 naming the expected formats', async () => {
    const csv = 'Product,Cost\nThing,10\n';
    await expect(parseProductSpreadsheet(Buffer.from(csv), 'csv')).rejects.toMatchObject({
      statusCode: 422,
      message: UNKNOWN_FORMAT_MESSAGE,
    });
    expect(UNKNOWN_FORMAT_MESSAGE).toMatch(/Shopify/);
    expect(UNKNOWN_FORMAT_MESSAGE).toMatch(/WooCommerce/);
  });

  it('rejects a header-only file with 422 (no products)', async () => {
    await expect(parseProductSpreadsheet(Buffer.from('Handle,Title,Variant Price\n'), 'csv')).rejects.toMatchObject({
      statusCode: 422,
      message: 'The file contains no products',
    });
  });

  it('rejects more than 1000 products with 422', async () => {
    const lines = ['Handle,Title,Variant Price'];
    for (let i = 0; i < 1001; i += 1) lines.push(`p${i},Product ${i},10`);
    await expect(parseProductSpreadsheet(Buffer.from(lines.join('\n')), 'csv')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a non-zip file uploaded as .xlsx and a zip uploaded as .csv', async () => {
    await expect(readXlsx(Buffer.from('Handle,Title\n'))).rejects.toBeInstanceOf(AppError);
    expect(() => readCsv(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toThrow(AppError);
  });

  it('rejects a corrupt zip as .xlsx with 400', async () => {
    await expect(readXlsx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('decodes UTF-16 LE CSV and skips leading blank lines', () => {
    const text = '\n\nHandle,Title,Variant Price\nmug,Mügg,5\n';
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
    const sheet = readCsv(buffer);
    expect(sheet.headers).toEqual(['handle', 'title', 'variant price']);
    expect(sheet.rows[0].cells.title).toBe('Mügg');
  });

  it('warns about malformed quotes', () => {
    const sheet = readCsv(Buffer.from('Handle,Title\nmug,"unterminated\n'));
    expect(sheet.warnings[0]).toMatch(/malformed quoted cell/);
  });

  it('detectSource prefers Shopify and returns null for unknown sets', () => {
    expect(detectSource(['handle', 'title', 'variant price'])).toBe('shopify');
    expect(detectSource(['id', 'type', 'name', 'sku'])).toBe('woocommerce');
    expect(detectSource(['foo'])).toBeNull();
  });

  it('cellValueToString covers every exceljs value shape', () => {
    expect(cellValueToString(null)).toBe('');
    expect(cellValueToString(undefined)).toBe('');
    expect(cellValueToString(true)).toBe('TRUE');
    expect(cellValueToString(false)).toBe('FALSE');
    expect(cellValueToString(12.5)).toBe('12.5');
    expect(cellValueToString(1e15)).toBe('1000000000000000');
    expect(cellValueToString(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
    expect(cellValueToString({ error: '#N/A' } as ExcelJS.CellErrorValue)).toBe('');
    expect(cellValueToString({ text: '', hyperlink: 'https://x.test' } as ExcelJS.CellHyperlinkValue)).toBe('https://x.test');
  });
});
