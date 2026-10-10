import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
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
        issues: ['No weight'],
        published: 'published',
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

  describe('official column schema', () => {
    const OFFICIAL = [
      'ID', 'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'Visibility in catalog', 'Short description',
      'Description', 'Date sale price starts', 'Date sale price ends', 'Tax status', 'Tax class', 'In stock?', 'Stock',
      'Low stock amount', 'Backorders allowed?', 'Sold individually?', 'Weight (kg)', 'Length (cm)', 'Width (cm)',
      'Height (cm)', 'Allow customer reviews?', 'Purchase note', 'Sale price', 'Regular price', 'Categories', 'Tags',
      'Shipping class', 'Images', 'Download limit', 'Download expiry days', 'Parent', 'Grouped products', 'Upsells',
      'Cross-sells', 'External URL', 'Button text', 'Position', 'Attribute 1 name', 'Attribute 1 value(s)',
      'Attribute 1 visible', 'Attribute 1 global', 'Attribute 2 name', 'Attribute 2 value(s)',
    ];
    const csvOf = (rows: Record<string, string>[], headers = OFFICIAL) => {
      const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))].join('\n');
    };
    const base = {
      Type: 'simple',
      Published: '1',
      'Regular price': '100',
      Description: 'd',
      Images: 'https://x.test/a.jpg, https://x.test/b.jpg',
    };

    it('imports weight, dimensions, stock, tags, categories and published from a simple product', () => {
      const csv = csvOf([
        {
          ...base,
          ID: '1',
          Name: 'Robe',
          'In stock?': '1',
          Stock: '25',
          'Weight (kg)': '0.75',
          'Length (cm)': '30',
          'Width (cm)': '20',
          'Height (cm)': '5',
          Tags: 'baby, cotton , baby',
          Categories: 'Textiles > Bathrobes > Baby, Gifts',
          'Is featured?': '1',
        },
      ]);
      const [p] = parse(csv).products;
      expect(p).toMatchObject({
        weightKg: 0.75,
        dimensions: '30 x 20 x 5 cm',
        stock: 25,
        tags: ['baby', 'cotton'],
        categoryPath: [['Textiles', 'Bathrobes', 'Baby'], ['Gifts']],
        published: 'published',
      });
      expect(p.issues).toEqual([]);
    });

    it.each([
      ['Weight (g)', '500', 0.5],
      ['Weight (lbs)', '2', 0.907],
      ['Weight (lb)', '1', 0.454],
      ['Weight (oz)', '16', 0.454],
      ['Weight (kg)', '1,5', 1.5],
    ])('converts %s %s to kg', (header, value, kg) => {
      const headers = ['ID', 'Type', 'Name', 'Regular price', header];
      const [p] = parse(csvOf([{ ID: '1', Type: 'simple', Name: 'A', 'Regular price': '5', [header]: value }], headers)).products;
      expect(p.weightKg).toBe(kg);
    });

    it('converts dimensions to cm, and keeps inches when every side is in inches', () => {
      const common = { Type: 'simple', 'Regular price': '5' };
      const mm = ['ID', 'Type', 'Name', 'Regular price', 'Length (mm)', 'Width (mm)', 'Height (m)'];
      const [a] = parse(
        csvOf([{ ...common, ID: '1', Name: 'A', 'Length (mm)': '250', 'Width (mm)': '100', 'Height (m)': '0.05' }], mm),
      ).products;
      expect(a.dimensions).toBe('25 x 10 x 5 cm');
      const inch = ['ID', 'Type', 'Name', 'Regular price', 'Length (in)', 'Width (in)', 'Height (in)'];
      const [b] = parse(
        csvOf([{ ...common, ID: '2', Name: 'B', 'Length (in)': '12', 'Width (in)': '8.5', 'Height (in)': '2' }], inch),
      ).products;
      expect(b.dimensions).toBe('12 x 8.5 x 2 in');
      const mixed = ['ID', 'Type', 'Name', 'Regular price', 'Length (in)', 'Width (cm)', 'Height (yd)'];
      const [c] = parse(
        csvOf([{ ...common, ID: '3', Name: 'C', 'Length (in)': '10', 'Width (cm)': '4', 'Height (yd)': '1' }], mixed),
      ).products;
      expect(c.dimensions).toBe('25.4 x 4 x 91.44 cm');
    });

    it('flags incomplete dimensions and omits them', () => {
      const [p] = parse(csvOf([{ ...base, ID: '1', Name: 'A', 'Length (cm)': '10' }])).products;
      expect(p.dimensions).toBeUndefined();
      expect(p.issues).toContain('Dimensions incomplete — length, width and height are all needed');
    });

    it('reads stock: number, blank + out of stock, blank + in stock, negative', () => {
      const rows: Record<string, string>[] = [
        { ...base, ID: '1', Name: 'A', Stock: '12' },
        { ...base, ID: '2', Name: 'B', 'In stock?': '0' },
        { ...base, ID: '3', Name: 'C', 'In stock?': '1' },
        { ...base, ID: '4', Name: 'D', Stock: '-3' },
      ];
      expect(parse(csvOf(rows)).products.map((p) => p.stock)).toEqual([12, 0, undefined, 0]);
    });

    it('variations: own stock, "parent" uses the parent stock, product stock is the sum, weight is the first variation with one', () => {
      const attr = (v: string) => ({ 'Attribute 1 name': 'Size', 'Attribute 1 value(s)': v });
      const rows: Record<string, string>[] = [
        { ID: '20', Type: 'variable', Name: 'Kurta', Published: '1', Description: 'd', Stock: '40', Images: 'https://x.test/k.jpg', ...attr('S, M, L') },
        { ID: '21', Type: 'variation', Name: 'Kurta - S', Parent: 'id:20', 'Regular price': '10', Stock: '5', ...attr('S') },
        {
          ID: '22', Type: 'variation', Name: 'Kurta - M', Parent: 'id:20', 'Regular price': '12', Stock: 'parent',
          'Weight (kg)': '0.3', 'Length (cm)': '10', 'Width (cm)': '10', 'Height (cm)': '2', ...attr('M'),
        },
        { ID: '23', Type: 'variation', Name: 'Kurta - L', Parent: 'id:20', 'Regular price': '14', 'In stock?': '0', 'Weight (kg)': '0.5', ...attr('L') },
      ];
      const [p] = parse(csvOf(rows)).products;
      expect(p.variants.map((v) => v.stock)).toEqual([5, 40, 0]);
      expect(p.variants.map((v) => v.weightKg)).toEqual([undefined, 0.3, 0.5]);
      expect(p.variants[1].dimensions).toEqual({ length: 10, width: 10, height: 2, unit: 'cm' });
      expect(p.stock).toBe(45);
      expect(p.weightKg).toBe(0.3);
      expect(p.dimensions).toBe('10 x 10 x 2 cm');
    });

    it('splits image URLs only on commas followed by http(s)://, and reports file names', () => {
      const images = 'https://x.test/a,b.jpg?w=1,2, https://x.test/c.jpg, photo.png, other.png';
      const [p] = parse(csvOf([{ ...base, ID: '1', Name: 'A', Images: images }])).products;
      expect(p.imageUrls).toEqual(['https://x.test/a,b.jpg?w=1,2', 'https://x.test/c.jpg']);
      expect(p.issues).toContain("Skipped 2 image link(s) that aren't valid web addresses");
    });

    it('adds publish-readiness issues for missing weight and a single image', () => {
      const [p] = parse(csvOf([{ ...base, ID: '1', Name: 'A', Images: 'https://x.test/a.jpg' }])).products;
      expect(p.issues).toEqual(expect.arrayContaining(['No weight', 'Fewer than 2 images']));
      const [none] = parse(csvOf([{ ...base, ID: '2', Name: 'B', Images: '' }])).products;
      expect(none.issues).toContain('No images');
      expect(none.issues).not.toContain('Fewer than 2 images');
    });

    it('maps Published 1 / 0 / -1 and ignores other values', () => {
      const rows = ['1', '0', '-1', ''].map((published, i) => ({ ...base, ID: String(i + 1), Name: `P${i}`, Published: published }));
      expect(parse(csvOf(rows)).products.map((p) => p.published)).toEqual(['published', 'private', 'draft', undefined]);
    });

    it('caps tags at 20 and 50 characters', () => {
      const tags = `${Array.from({ length: 25 }, (_, i) => `t${i}`).join(',')},${'x'.repeat(80)}`;
      const [p] = parse(csvOf([{ ...base, ID: '1', Name: 'A', Tags: tags }])).products;
      expect(p.tags).toHaveLength(20);
      expect(p.issues.some((i) => i.startsWith('Only the first 20'))).toBe(true);
      const [q] = parse(csvOf([{ ...base, ID: '2', Name: 'B', Tags: 'x'.repeat(80) }])).products;
      expect(q.tags?.[0]).toHaveLength(50);
    });

    it('prefers Description over Short description and ignores Sale price', () => {
      const [p] = parse(csvOf([{ ...base, ID: '1', Name: 'A', 'Short description': 'short', Description: 'long', 'Sale price': '1' }])).products;
      expect(p.description).toBe('long');
      expect(p.sellerPrice).toBe(100);
    });

    it('skips virtual, downloadable, grouped and external types (comma-separated Type) naming the row', () => {
      const rows: Record<string, string>[] = [
        { ...base, ID: '1', Type: 'simple, virtual', Name: 'Voucher' },
        { ...base, ID: '2', Type: 'simple, downloadable, virtual', Name: 'Ebook' },
        { ...base, ID: '3', Type: 'grouped', Name: 'G' },
        { ...base, ID: '4', Type: 'external', Name: 'E' },
        { ...base, ID: '5', Type: 'variable, virtual', Name: 'VarV' },
        { ID: '6', Type: 'variation', Name: 'child', Parent: 'id:5', 'Regular price': '3' },
        { ...base, ID: '7', Type: 'simple', Name: 'Real' },
      ];
      const { products, warnings } = parse(csvOf(rows));
      expect(products.map((p) => p.name)).toEqual(['Real']);
      expect(warnings).toEqual([
        'Row 2 skipped: "Voucher" — virtual products have nothing to ship',
        'Row 3 skipped: "Ebook" — virtual products have nothing to ship',
        "Row 4 skipped: grouped products can't be imported",
        "Row 5 skipped: external/affiliate products can't be imported",
        'Row 6 skipped: "VarV" — virtual products have nothing to ship',
      ]);
    });

    it('end to end through an .xlsx round trip', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Products');
      ws.addRow(OFFICIAL);
      const row: Record<string, string> = {
        ...base,
        ID: '9',
        Name: 'Basket',
        Stock: '7',
        'Weight (kg)': '1.2',
        Categories: 'Home > Storage',
        Tags: 'jute',
      };
      ws.addRow(OFFICIAL.map((h) => row[h] ?? ''));
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const preview = await parseProductSpreadsheet(buffer, 'xlsx');
      expect(preview.source).toBe('woocommerce');
      expect(preview.products[0]).toMatchObject({
        key: '9',
        weightKg: 1.2,
        stock: 7,
        tags: ['jute'],
        categoryPath: [['Home', 'Storage']],
      });
    });
  });
});
