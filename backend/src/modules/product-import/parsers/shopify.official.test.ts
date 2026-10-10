import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { readCsv } from './spreadsheet';
import { isShopifyHeaderSet, parseShopifyRows } from './shopify';
import { detectSource, parseProductSpreadsheet } from './index';

/** Shopify's own sample file (legacy header names), verbatim. */
const SHOPIFY_TEMPLATE_CSV = `Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Google Shopping / Google Product Category,Google Shopping / Gender,Google Shopping / Age Group,Google Shopping / MPN,Google Shopping / AdWords Grouping,Google Shopping / AdWords Labels,Google Shopping / Condition,Google Shopping / Custom Product,Google Shopping / Custom Label 0,Google Shopping / Custom Label 1,Google Shopping / Custom Label 2,Google Shopping / Custom Label 3,Google Shopping / Custom Label 4,Variant Image,Variant Weight Unit,Variant Tax Code,Cost per item,Price / International,Compare At Price / International,Status
example-t-shirt,Example T-Shirt,"<p><em>This is a demonstration store. You can purchase products like this from <a href=""http://babyandco.us/"" target=""_blank"">Baby &amp; Company</a></em></p><p>Internationally respected for merging art and fashion, Avant Toi specially dyed T’s are indispensable for the growing collection. Color Navy/Black. Made in Italy. <em>Addis is wearing a size Medium. Addis is 6’2”, Chest 38.5”,  Waist 31”, Inseam 32”.</em></p>",Acme,Apparel & Accessories > Clothing,Shirts,mens t-shirt example,TRUE,Title,"Lithograph - Height: 9"" x Width: 12""",,,,,,3629,,,deny,manual,25,,TRUE,TRUE,,https://burst.shopifycdn.com/photos/green-t-shirt.jpg?width=5000,1,,FALSE,Our awesome T-shirt in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,7X8ABC910,T-shirts,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,active
example-t-shirt,,,,,,,,,Small,,,,,example-shirt-s,200,,,deny,manual,19.99,24.99,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,g,,,,,
example-t-shirt,,,,,,,,,Medium,,,,,example-shirt-m,200,shopify,,deny,manual,19.99,24.99,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,g,,,,,
example-pants,Example Pants,,Acme,Apparel & Accessories > Clothing,Pants,mens pants example,FALSE,Title,"Jeans, W32H34",,,,,,1250,,,deny,manual,49.99,57.99,TRUE,TRUE,,https://burst.shopifycdn.com/photos/distressed-kids-jeans.jpg?width=5000,1,,FALSE,Our awesome Pants in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,7Y2ABD712,Pants,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,draft
example-hat,Example Hat,,Acme,Apparel & Accessories > Clothing,Hat,mens hat example,FALSE,Title,Grey,,,,,,275,,,deny,manual,17.99,22.99,TRUE,TRUE,,https://burst.shopifycdn.com/photos/kids-beanie.jpg?width=5000,1,,FALSE,Our awesome Hat in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,5P1NBQ314,Hat,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,archived
example-t-shirt,Example T-Shirt,,Acme,Apparel & Accessories > Clothing,Shirts,mens t-shirt example,TRUE,Title,"Lithograph - Height: 9"" x Width: 12""",,,,,,3629,,,deny,manual,25,,TRUE,TRUE,,https://burst.shopifycdn.com/photos/green-t-shirt.jpg?width=5000,1,,FALSE,Our awesome T-shirt in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,7X8ABC910,T-shirts,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,active
example-t-shirt,,,,,,,,,Small,,,,,example-shirt-s,200,,,deny,manual,19.99,24.99,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,g,,,,,
example-t-shirt,,,,,,,,,Medium,,,,,example-shirt-m,200,shopify,,deny,manual,19.99,24.99,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,g,,,,,
example-pants,Example Pants,,Acme,Apparel & Accessories > Clothing,Pants,mens pants example,FALSE,Title,"Jeans, W32H34",,,,,,1250,,,deny,manual,49.99,57.99,TRUE,TRUE,,https://burst.shopifycdn.com/photos/distressed-kids-jeans.jpg?width=5000,1,,FALSE,Our awesome Pants in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,7Y2ABD712,Pants,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,draft
example-hat,Example Hat,,Acme,Apparel & Accessories > Clothing,Hat,mens hat example,FALSE,Title,Grey,,,,,,275,,,deny,manual,17.99,22.99,TRUE,TRUE,,https://burst.shopifycdn.com/photos/kids-beanie.jpg?width=5000,1,,FALSE,Our awesome Hat in 70 characters or less.,A great description of your products in 320 characters or less,Apparel & Accessories > Clothing,Unisex,Adult,5P1NBQ314,Hat,"cotton, pre-shrunk",used,FALSE,,,,,,,g,,,,,archived
Note: Red column is required,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

function parse(csv: string) {
  const sheet = readCsv(Buffer.from(csv, 'utf8'));
  return parseShopifyRows(sheet.rows, sheet.headers);
}

const LEGACY =
  'Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Inventory Qty,Variant Price,Image Src,Image Position,Status';
const CURRENT =
  'URL handle,Title,Description,Vendor,Product category,Type,Tags,Published on online store,Status,SKU,Option1 name,Option1 value,Price,Weight value (grams),Weight unit for display,Inventory quantity,Packed product length,Packed product width,Packed product height,Packed product dimension unit,Product image URL,Image position,Image alt text';

describe('Shopify official template (legacy headers)', () => {
  it('parses the user sample file: 3 products, junk note ignored, duplicates collapsed', async () => {
    const preview = await parseProductSpreadsheet(Buffer.from(SHOPIFY_TEMPLATE_CSV, 'utf8'), 'csv');
    expect(preview.source).toBe('shopify');
    expect(preview.warnings).toEqual(['Row 12 ignored: it has a handle but no product data']);
    expect(preview.products.map((p) => p.key)).toEqual(['example-t-shirt', 'example-pants', 'example-hat']);

    const [tee, pants, hat] = preview.products;

    expect(tee.name).toBe('Example T-Shirt');
    expect(tee.weightKg).toBe(3.629);
    expect(tee.sellerPrice).toBe(19.99);
    expect(tee.published).toBe('published');
    expect(tee.tags).toEqual(['mens t-shirt example']);
    expect(tee.categoryPath).toEqual([['Apparel & Accessories', 'Clothing'], ['Shirts']]);
    expect(tee.variants.map((v) => v.name)).toEqual(['Lithograph - Height: 9" x Width: 12"', 'Small', 'Medium']);
    expect(tee.variants.map((v) => v.weightKg)).toEqual([3.629, 0.2, 0.2]);
    expect(tee.variants.map((v) => v.sellerPrice)).toEqual([25, 19.99, 19.99]);
    expect(tee.variants.map((v) => v.sku)).toEqual([null, 'example-shirt-s', 'example-shirt-m']);
    expect(tee.imageUrls).toEqual(['https://burst.shopifycdn.com/photos/green-t-shirt.jpg?width=5000']);
    expect(tee.issues).toContain('Removed 3 duplicate variant row(s)');
    expect(tee.description).toContain('Internationally respected');
    expect(tee.description).not.toContain('<');
    expect(tee.stock).toBeUndefined();

    expect(pants.published).toBe('draft');
    expect(pants.weightKg).toBe(1.25);
    expect(pants.sellerPrice).toBe(49.99);
    expect(pants.variants).toEqual([]);
    expect(pants.categoryPath).toEqual([['Apparel & Accessories', 'Clothing'], ['Pants']]);
    expect(pants.issues).not.toContain('No weight');

    expect(hat.published).toBe('private');
    expect(hat.issues.filter((i) => i === 'Archived in Shopify')).toHaveLength(1);
    expect(hat.weightKg).toBe(0.275);

    const dump = JSON.stringify(preview);
    expect(dump).not.toContain('Acme');
    expect(dump).not.toContain('7X8ABC910');
    expect(dump).not.toContain('24.99');
  });

  it('is detected as Shopify, not WooCommerce', () => {
    const sheet = readCsv(Buffer.from(SHOPIFY_TEMPLATE_CSV, 'utf8'));
    expect(detectSource(sheet.headers)).toBe('shopify');
  });
});

describe('Shopify current headers', () => {
  it('maps URL handle, Description, weight, stock, packed dimensions, images and publish state', () => {
    const csv = [
      CURRENT,
      'vase,Blue Vase,<p>Glazed</p>,Acme,Home & Garden > Decor > Vases,Ceramics,"clay, blue",TRUE,active,V-S,Size,Small,100,500,g,12,30,20,10,cm,https://x.test/a.jpg,2,front',
      'vase,,,,,,,,,V-L,,Large,150,1500,g,-4,12,8,6,in,,,',
      'vase,,,,,,,,,,,,,,,,,,,,https://x.test/b.jpg,1,back',
    ].join('\n');
    const { products, warnings } = parse(csv);
    expect(warnings).toEqual([]);
    const [p] = products;
    expect(p.name).toBe('Blue Vase');
    expect(p.description).toBe('Glazed');
    expect(p.imageUrls).toEqual(['https://x.test/b.jpg', 'https://x.test/a.jpg']);
    expect(p.published).toBe('published');
    expect(p.tags).toEqual(['clay', 'blue']);
    expect(p.categoryPath).toEqual([['Home & Garden', 'Decor', 'Vases'], ['Ceramics']]);
    expect(p.variants).toEqual([
      {
        name: 'Small',
        options: { Size: 'Small' },
        sku: 'V-S',
        sellerPrice: 100,
        stock: 12,
        weightKg: 0.5,
        dimensions: { length: 30, width: 20, height: 10, unit: 'cm' },
      },
      {
        name: 'Large',
        options: { Size: 'Large' },
        sku: 'V-L',
        sellerPrice: 150,
        stock: 0,
        weightKg: 1.5,
        dimensions: { length: 12, width: 8, height: 6, unit: 'in' },
      },
    ]);
    expect(p.weightKg).toBe(0.5);
    expect(p.dimensions).toBe('30 x 20 x 10 cm');
    expect(p.stock).toBe(12);
    expect(JSON.stringify(p)).not.toContain('Acme');
  });

  it('Published on online store FALSE with active status becomes private', () => {
    const csv = [CURRENT, 'a,A,,,,,,FALSE,active,A1,,,10,100,,,,,,,,,'].join('\n');
    expect(parse(csv).products[0].published).toBe('private');
  });

  it('is detected as Shopify through parseProductSpreadsheet', async () => {
    const preview = await parseProductSpreadsheet(
      Buffer.from(`${CURRENT}\na,A,,,,,,TRUE,active,A1,,,10,100,,5,,,,,,,\n`, 'utf8'),
      'csv',
    );
    expect(preview.source).toBe('shopify');
    expect(preview.products[0]).toMatchObject({ weightKg: 0.1, stock: 5, sellerPrice: 10 });
  });

  it('round-trips through .xlsx with numeric cells', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.addRow(CURRENT.split(','));
    sheet.addRow([
      'rug', 'Jute Rug', 'Soft', 'Acme', 'Home > Rugs', 'Rugs', 'jute', 'TRUE', 'active', 'R1', null, null,
      899.5, 2500, 'g', 7, 90, 60, 5, 'cm', 'https://x.test/r.jpg', 1, null,
    ]);
    const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const preview = await parseProductSpreadsheet(buffer, 'xlsx');
    expect(preview.source).toBe('shopify');
    expect(preview.products[0]).toMatchObject({
      key: 'rug',
      sellerPrice: 899.5,
      weightKg: 2.5,
      stock: 7,
      dimensions: '90 x 60 x 5 cm',
      tags: ['jute'],
      categoryPath: [['Home', 'Rugs'], ['Rugs']],
      published: 'published',
    });
  });
});

describe('Shopify edge cases', () => {
  it('treats grams 0 or blank as not stated and flags No weight', () => {
    const csv = [LEGACY, 'a,A,,,,,,TRUE,,,A1,0,,10,,,active', 'b,B,,,,,,TRUE,,,B1,,,10,,,active'].join('\n');
    for (const p of parse(csv).products) {
      expect(p.weightKg).toBeUndefined();
      expect(p.issues).toContain('No weight');
    }
  });

  it('rounds tiny weights up to 0.001 and clamps huge ones', () => {
    const csv = [LEGACY, 'a,A,,,,,,,,,A1,0.4,,10,,,', 'b,B,,,,,,,,,B1,999999999999,,10,,,'].join('\n');
    const [a, b] = parse(csv).products;
    expect(a.weightKg).toBe(0.001);
    expect(b.weightKg).toBe(100000);
  });

  it('ignores a numeric taxonomy id and falls back to Type', () => {
    const csv = [LEGACY, 'a,A,,,2271,Lamps,,,,,A1,100,,10,,,'].join('\n');
    expect(parse(csv).products[0].categoryPath).toEqual([['Lamps']]);
  });

  it('omits a partial dimension set with an issue', () => {
    const csv = [CURRENT, 'a,A,,,,,,,,A1,,,10,100,,,10,5,,cm,,,'].join('\n');
    const [p] = parse(csv).products;
    expect(p.dimensions).toBeUndefined();
    expect(p.issues).toContain('Dimensions incomplete — length, width and height are all needed');
  });

  it('blank inventory is not stated; Published FALSE without Status is private', () => {
    const csv = [LEGACY, 'a,A,,,,,,FALSE,,,A1,100,,10,,,'].join('\n');
    const [p] = parse(csv).products;
    expect(p.stock).toBeUndefined();
    expect(p.published).toBe('private');
  });

  it('keeps image-only continuation rows as images, not variants', () => {
    const csv = [
      LEGACY,
      'a,A,,,,,,,,,A1,100,,10,https://x.test/1.jpg,1,active',
      'a,,,,,,,,,,,,,,https://x.test/2.jpg,2,',
    ].join('\n');
    const [p] = parse(csv).products;
    expect(p.imageUrls).toEqual(['https://x.test/1.jpg', 'https://x.test/2.jpg']);
    expect(p.variants).toEqual([]);
  });

  it('a new handle with a title but nothing else is still a product', () => {
    const csv = [LEGACY, 'solo,Solo,,,,,,,,,,,,,,,'].join('\n');
    const { products, warnings } = parse(csv);
    expect(warnings).toEqual([]);
    expect(products).toHaveLength(1);
  });

  it('detects both Shopify header sets and still detects WooCommerce', () => {
    const norm = (h: string) => h.split(',').map((x) => x.trim().toLowerCase());
    expect(isShopifyHeaderSet(norm(LEGACY))).toBe(true);
    expect(isShopifyHeaderSet(norm(CURRENT))).toBe(true);
    expect(isShopifyHeaderSet(norm('URL handle,Title'))).toBe(false);
    const woo = norm('ID,Type,SKU,Name,Published,Regular price,Categories');
    expect(isShopifyHeaderSet(woo)).toBe(false);
    expect(detectSource(woo)).toBe('woocommerce');
    expect(detectSource(norm(CURRENT))).toBe('shopify');
  });
});
