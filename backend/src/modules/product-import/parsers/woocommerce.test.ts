import { describe, it, expect } from 'vitest';
import { readCsv } from './spreadsheet';
import { isWooCommerceHeaderSet, parseWooCommerceRows } from './woocommerce';
import { parseProductSpreadsheet } from './index';

const HEADER =
  'ID,Type,SKU,Name,Published,Short description,Description,Sale price,Regular price,Images,Parent,' +
  'Attribute 1 name,Attribute 1 value(s),Attribute 2 name,Attribute 2 value(s)';

function parse(csv: string) {
  const sheet = readCsv(Buffer.from(csv, 'utf8'));
  return parseWooCommerceRows(sheet.rows, sheet.headers);
}

describe('WooCommerce parser', () => {
  it('recognises the WooCommerce header set', () => {
    const sheet = readCsv(Buffer.from(`${HEADER}\n`, 'utf8'));
    expect(isWooCommerceHeaderSet(sheet.headers)).toBe(true);
    expect(isWooCommerceHeaderSet(['handle', 'title'])).toBe(false);
  });

  it('parses a simple product using Regular price (not Sale price)', () => {
    const csv = [
      HEADER,
      '10,simple,SCARF-1,Silk Scarf,1,Short,"<p>Pure <em>silk</em> scarf</p>",800,1000,"https://shop.test/a.jpg, https://shop.test/b.jpg",,Material,"Silk, Cotton",,',
    ].join('\n');
    const { products, warnings } = parse(csv);
    expect(warnings).toEqual([]);
    expect(products).toEqual([
      {
        key: '10',
        name: 'Silk Scarf',
        description: 'Pure silk scarf',
        imageUrls: ['https://shop.test/a.jpg', 'https://shop.test/b.jpg'],
        sellerPrice: 1000,
        variants: [],
        materials: 'Silk, Cotton',
        issues: [],
      },
    ]);
  });

  it('attaches variations to a variable parent via id:N and via parent SKU', () => {
    const csv = [
      HEADER,
      '20,variable,KURTA,Cotton Kurta,1,,Kurta desc,,,https://shop.test/k.jpg,,Size,"S, M",Color,Blue',
      '21,variation,KURTA-S,Cotton Kurta - S,1,,,,1200,https://shop.test/ks.jpg,id:20,Size,S,Color,Blue',
      '22,variation,KURTA-M,Cotton Kurta - M,1,,,,"1,100.00",,KURTA,Size,M,Color,Blue',
    ].join('\n');
    const [p] = parse(csv).products;
    expect(p.key).toBe('20');
    expect(p.variants).toEqual([
      { name: 'S / Blue', options: { Size: 'S', Color: 'Blue' }, sku: 'KURTA-S', sellerPrice: 1200 },
      { name: 'M / Blue', options: { Size: 'M', Color: 'Blue' }, sku: 'KURTA-M', sellerPrice: 1100 },
    ]);
    expect(p.sellerPrice).toBe(1100);
    expect(p.imageUrls).toEqual(['https://shop.test/k.jpg', 'https://shop.test/ks.jpg']);
  });

  it('handles variations listed before their parent', () => {
    const csv = [
      HEADER,
      '31,variation,,Bag - Red,1,,,,500,,id:30,Color,Red,,',
      '32,variation,,Bag - Green,1,,,,450,,id:30,Color,Green,,',
      '30,variable,BAG,Bag,1,,,,,https://shop.test/bag.jpg,,Color,"Red, Green",,',
    ].join('\n');
    const [p] = parse(csv).products;
    expect(p.variants.map((v) => v.name)).toEqual(['Red', 'Green']);
    expect(p.sellerPrice).toBe(450);
  });

  it('warns about orphan variations and skips grouped/external products', () => {
    const csv = [
      HEADER,
      '40,variation,,Lost,1,,,,10,,id:999,Size,S,,',
      '41,grouped,,Group,1,,,,,,,,,,',
      '42,external,,Affiliate,1,,,,5,,,,,,',
    ].join('\n');
    const { products, warnings } = parse(csv);
    expect(products).toEqual([]);
    expect(warnings).toEqual([
      'Row 3 skipped: grouped products can\'t be imported',
      "Row 4 skipped: external/affiliate products can't be imported",
      'Row 2 skipped: variation\'s parent product "id:999" isn\'t in the file',
    ]);
  });

  it('flags a missing regular price, sale-price-only, and variable products without variations', () => {
    const csv = [HEADER, '50,simple,,Sale Only,1,,,99,,,,,,,', '51,variable,,Empty Var,1,,,,,,,,,,'].join('\n');
    const [saleOnly, emptyVar] = parse(csv).products;
    expect(saleOnly.sellerPrice).toBeNull();
    expect(saleOnly.issues).toEqual(expect.arrayContaining(['No price found']));
    expect(saleOnly.issues.some((i) => i.startsWith('Only a sale price was found'))).toBe(true);
    expect(emptyVar.issues).toContain('Variable product has no variations in this file');
  });

  it('falls back to Short description and decodes literal \\n escapes', () => {
    const csv = [HEADER, '60,simple,,Lamp,1,"Brass lamp\\nwith shade",,,300,,,,,,'].join('\n');
    expect(parse(csv).products[0].description).toBe('Brass lamp\nwith shade');
  });

  it('keys products without an ID by SKU, then row, keeping keys unique', () => {
    const csv = [HEADER, ',simple,SKU-A,A,1,,,,1,,,,,,', ',simple,SKU-A,A again,1,,,,1,,,,,,', ',simple,,No ids,1,,,,1,,,,,,'].join('\n');
    expect(parse(csv).products.map((p) => p.key)).toEqual(['SKU-A', 'SKU-A-2', 'row-4']);
  });

  it('a variable product with a single variation is treated as a simple product', () => {
    const csv = [HEADER, '70,variable,,Solo,1,,,,,,,Size,One,,', '71,variation,,Solo - One,1,,,,640,,id:70,Size,One,,'].join('\n');
    const [p] = parse(csv).products;
    expect(p.variants).toEqual([]);
    expect(p.sellerPrice).toBe(640);
  });

  it('end to end: semicolon-delimited CSV (Excel in European locales) is detected as WooCommerce', async () => {
    const csv = [HEADER.replace(/,/g, ';'), '80;simple;S80;Basket;1;;;;"12,50";;;;;;'].join('\n');
    const preview = await parseProductSpreadsheet(Buffer.from(csv, 'utf8'), 'csv');
    expect(preview.source).toBe('woocommerce');
    expect(preview.products[0].sellerPrice).toBe(12.5);
  });
});
