import { describe, it, expect } from 'vitest';
import { readCsv } from './spreadsheet';
import { parseShopifyRows, isShopifyHeaderSet } from './shopify';
import { parseProductSpreadsheet } from './index';

const HEADER =
  'Handle,Title,Body (HTML),Vendor,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,' +
  'Variant SKU,Variant Price,Image Src,Image Position,Variant Image,Status';

function parse(csv: string) {
  const sheet = readCsv(Buffer.from(csv, 'utf8'));
  return parseShopifyRows(sheet.rows, sheet.headers);
}

describe('Shopify parser', () => {
  it('recognises the Shopify header set', () => {
    const sheet = readCsv(Buffer.from(`${HEADER}\n`, 'utf8'));
    expect(isShopifyHeaderSet(sheet.headers)).toBe(true);
    expect(isShopifyHeaderSet(['handle', 'name'])).toBe(false);
  });

  it('groups rows by Handle into one multi-variant, multi-image product', () => {
    const csv = [
      HEADER,
      'runner,Table Runner,"<p>Hand <b>woven</b> &amp; dyed.</p><p>Second para</p>",Acme,Size,Small,Color,Red,,,RUN-S-R,499.00,https://cdn.shopify.com/a.jpg,1,,active',
      'runner,,,,,Large,,Red,,,RUN-L-R,"1,299.00",https://cdn.shopify.com/b.jpg,2,https://cdn.shopify.com/v.jpg,',
      'runner,,,,,,,,,,,,https://cdn.shopify.com/c.jpg,3,,',
    ].join('\n');

    const { products, warnings } = parse(csv);
    expect(warnings).toEqual([]);
    expect(products).toHaveLength(1);
    const [p] = products;
    expect(p.key).toBe('runner');
    expect(p.name).toBe('Table Runner');
    expect(p.description).toBe('Hand woven & dyed.\nSecond para');
    expect(p.imageUrls).toEqual([
      'https://cdn.shopify.com/a.jpg',
      'https://cdn.shopify.com/b.jpg',
      'https://cdn.shopify.com/c.jpg',
      'https://cdn.shopify.com/v.jpg',
    ]);
    expect(p.variants).toEqual([
      { name: 'Small / Red', options: { Size: 'Small', Color: 'Red' }, sku: 'RUN-S-R', sellerPrice: 499 },
      { name: 'Large / Red', options: { Size: 'Large', Color: 'Red' }, sku: 'RUN-L-R', sellerPrice: 1299 },
    ]);
    expect(p.sellerPrice).toBe(499);
    expect(p.materials).toBeNull();
    expect(p.issues).toEqual([]);
  });

  it('collapses a single "Default Title" variant into a simple product', () => {
    const csv = [HEADER, 'mug,Clay Mug,<p>Mug</p>,,Title,Default Title,,,,,MUG-1,250,https://x.test/m.jpg,1,,active'].join('\n');
    const [p] = parse(csv).products;
    expect(p.variants).toEqual([]);
    expect(p.sellerPrice).toBe(250);
  });

  it('keeps a quoted multi-line Body (HTML) cell intact', () => {
    const csv = `${HEADER}\nbowl,Bowl,"<p>Line one</p>\n<ul><li>Food safe</li>\n<li>Handmade</li></ul>",,,,,,,,B1,100,https://x.test/b.jpg,1,,active\n`;
    const { products } = parse(csv);
    expect(products).toHaveLength(1);
    expect(products[0].description).toBe('Line one\n\n• Food safe\n• Handmade');
  });

  it('flags a missing price, missing images and missing description', () => {
    const csv = [HEADER, 'plain,Plain Thing,,,,,,,,,P1,,,,,draft'].join('\n');
    const [p] = parse(csv).products;
    expect(p.sellerPrice).toBeNull();
    expect(p.issues).toEqual(expect.arrayContaining(['No price found', 'No images', 'No description']));
  });

  it('picks the cheapest variant price and reports unpriced variants', () => {
    const csv = [
      HEADER,
      'tee,Tee,,,Size,S,,,,,T-S,300,,,,active',
      'tee,,,,,M,,,,,T-M,,,,,',
      'tee,,,,,L,,,,,T-L,250,,,,',
    ].join('\n');
    const [p] = parse(csv).products;
    expect(p.sellerPrice).toBe(250);
    expect(p.variants.map((v) => v.sellerPrice)).toEqual([300, null, 250]);
    expect(p.issues).toContain('1 variant(s) have no price');
  });

  it('collects materials from a Material option', () => {
    const csv = [HEADER, 'rug,Rug,,,Material,Jute,,,,,R-J,900,,,,', 'rug,,,,,Cotton,,,,,R-C,800,,,,'].join('\n');
    const [p] = parse(csv).products;
    expect(p.materials).toBe('Jute, Cotton');
  });

  it('reads a Shopify material metafield column', () => {
    const csv = [
      `${HEADER},Material (product.metafields.shopify.material)`,
      'vase,Vase,,,,,,,,,V1,700,,,,active,ceramic; glaze',
    ].join('\n');
    expect(parse(csv).products[0].materials).toBe('ceramic, glaze');
  });

  it('truncates long names and drops duplicate SKUs within a product', () => {
    const longTitle = 'A'.repeat(80);
    const csv = [
      HEADER,
      `long,${longTitle},,,Size,S,,,,,DUP,10,,,,`,
      'long,,,,,M,,,,,DUP,12,,,,',
    ].join('\n');
    const [p] = parse(csv).products;
    expect(p.name).toHaveLength(60);
    expect(p.variants.map((v) => v.sku)).toEqual(['DUP', null]);
    expect(p.issues).toEqual(
      expect.arrayContaining(['Name shortened to 60 characters', 'Removed 1 duplicate or over-long variant SKU(s)']),
    );
  });

  it('skips rows with no Handle and flags archived products', () => {
    const csv = [HEADER, ',Orphan,,,,,,,,,,1,,,,', 'old,Old,,,,,,,,,O1,5,,,,archived'].join('\n');
    const { products, warnings } = parse(csv);
    expect(warnings).toEqual(['Row 2 skipped: no Handle']);
    expect(products[0].issues).toContain('Archived in Shopify');
  });

  it('drops non-http image links and caps images at 10', () => {
    const rows = [HEADER, 'pics,Pics,,,,,,,,,P,1,javascript:alert(1),1,,'];
    for (let i = 0; i < 12; i += 1) rows.push(`pics,,,,,,,,,,,,https://x.test/${i}.jpg,${i + 2},,`);
    const [p] = parse(rows.join('\n')).products;
    expect(p.imageUrls).toHaveLength(10);
    expect(p.imageUrls[0]).toBe('https://x.test/0.jpg');
    expect(p.issues).toEqual(
      expect.arrayContaining([
        "Skipped 1 image link(s) that aren't valid web addresses",
        'Only the first 10 of 12 images will be imported',
      ]),
    );
  });

  it('end to end: detects Shopify through parseProductSpreadsheet (BOM, CRLF)', async () => {
    const csv = `\uFEFF${HEADER}\r\nmug,Mug,,,,,,,,,M1,99,https://x.test/m.jpg,1,,active\r\n`;
    const preview = await parseProductSpreadsheet(Buffer.from(csv, 'utf8'), 'csv');
    expect(preview.source).toBe('shopify');
    expect(preview.products[0]).toMatchObject({ key: 'mug', name: 'Mug', sellerPrice: 99 });
  });
});
