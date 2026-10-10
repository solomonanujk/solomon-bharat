import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, ProductApprovalStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { ProductImportService } from './product-import.service';
import type { ProductImportRepository } from './product-import.repository';
import type { ProductsRepository } from '../products/products.repository';
import type { CategoriesService } from '../categories/categories.service';
import type { SellersService } from '../sellers/sellers.service';
import type { StorageProvider } from '../../providers/storage';
import type { FetchedImage } from './product-import.images';
import type { ImportCandidate } from './product-import.types';

vi.mock('../../config/prisma', () => ({ prisma: {} }));
vi.mock('../../providers/storage', () => ({ storageProvider: {} }));

const SELLER_ID = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';

function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    key: 'runner',
    name: 'Table Runner',
    description: 'Hand woven',
    imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    sellerPrice: 499,
    variants: [],
    materials: 'Cotton',
    issues: [],
    ...overrides,
  };
}

const JPEG: FetchedImage = { buffer: Buffer.from([0xff, 0xd8, 0xff]), extension: 'jpg' };

function setup() {
  const repo = { findExistingVariantSkus: vi.fn().mockResolvedValue([]) } as unknown as ProductImportRepository;
  const productsRepo = {
    slugExists: vi.fn().mockResolvedValue(false),
    findSellerContext: vi.fn().mockResolvedValue({ sellerType: 'CURATED', brand: null }),
    create: vi.fn().mockImplementation((_sellerId: string, input: { id: string; name: string; slug: string }) =>
      Promise.resolve({ id: input.id, name: input.name, slug: input.slug }),
    ),
  } as unknown as ProductsRepository;
  const categories = {
    assertValidLeafCategory: vi.fn().mockResolvedValue({ id: CATEGORY_ID, level: 3 }),
    getPublicTree: vi.fn().mockResolvedValue([]),
  } as unknown as CategoriesService;
  const sellers = {
    getMyProfile: vi.fn().mockResolvedValue({ id: SELLER_ID }),
    getSellerDetailForAdmin: vi.fn().mockResolvedValue({ id: SELLER_ID }),
  } as unknown as Pick<SellersService, 'getMyProfile' | 'getSellerDetailForAdmin'>;
  const fetchImage = vi.fn<(url: string) => Promise<FetchedImage | null>>().mockResolvedValue(JPEG);
  let n = 0;
  const storage = {
    uploadImage: vi.fn().mockImplementation(() => {
      n += 1;
      return Promise.resolve({ url: `https://res.cloudinary.test/${n}.jpg`, publicId: `pub-${n}` });
    }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageProvider;
  const audit = vi.fn().mockResolvedValue(undefined);
  const service = new ProductImportService(repo, productsRepo, categories, sellers, fetchImage, storage, audit);
  return { service, repo, productsRepo, categories, sellers, fetchImage, storage, audit };
}

describe('ProductImportService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('preview', () => {
    const csv = 'Handle,Title,Variant Price,Image Src\nmug,Mug,99,https://x.test/m.jpg\n';

    it('parses a CSV for the authenticated seller', async () => {
      const { service, sellers } = setup();
      const result = await service.previewForSeller('user-1', {
        buffer: Buffer.from(csv),
        originalname: 'products_export.csv',
        mimetype: 'text/csv',
      });
      expect(sellers.getMyProfile).toHaveBeenCalledWith('user-1');
      expect(result.source).toBe('shopify');
      expect(result.products).toHaveLength(1);
    });

    it('404s for admin preview when the seller does not exist', async () => {
      const { service, sellers } = setup();
      vi.mocked(sellers.getSellerDetailForAdmin).mockRejectedValue(AppError.notFound('Seller not found'));
      await expect(
        service.previewForAdmin(SELLER_ID, { buffer: Buffer.from(csv), originalname: 'a.csv', mimetype: 'text/csv' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('parses for an existing seller on admin preview', async () => {
      const { service } = setup();
      const result = await service.previewForAdmin(SELLER_ID, {
        buffer: Buffer.from(csv),
        originalname: 'a.CSV',
        mimetype: 'text/csv',
      });
      expect(result.products[0].name).toBe('Mug');
    });

    describe('category suggestions', () => {
      const wooCsv =
        'ID,Type,Name,Regular price,Categories\n1,simple,Robe,10,Textiles > Bathrobes > Baby\n2,simple,Misc,10,Unknown\n3,simple,Bare,10,\n';
      const tree = [
        {
          id: 't', name: 'Textiles', slug: 'textiles', level: 1, status: 'ACTIVE',
          children: [
            {
              id: 'b', name: 'Bathrobes', slug: 'bathrobes', level: 2, status: 'ACTIVE',
              children: [{ id: 'baby', name: 'Baby', slug: 'baby', level: 3, status: 'ACTIVE', children: [] }],
            },
          ],
        },
      ];

      it('fills suggestedCategory from the category tree', async () => {
        const { service, categories } = setup();
        vi.mocked(categories.getPublicTree).mockResolvedValue(tree as never);
        const { products } = await service.preview({ buffer: Buffer.from(wooCsv), originalname: 'w.csv', mimetype: 'text/csv' });
        expect(products[0].suggestedCategory).toEqual({ id: 'baby', name: 'Baby', path: 'Textiles > Bathrobes > Baby' });
        expect(products[1].suggestedCategory).toBeNull();
        expect(products[2].suggestedCategory).toBeUndefined();
      });

      it('still returns the preview when the category tree cannot be loaded', async () => {
        const { service, categories } = setup();
        vi.mocked(categories.getPublicTree).mockRejectedValue(new Error('redis down'));
        const { products } = await service.preview({ buffer: Buffer.from(wooCsv), originalname: 'w.csv', mimetype: 'text/csv' });
        expect(products).toHaveLength(3);
        expect(products[0].suggestedCategory).toBeUndefined();
      });

      it('does not load categories for files without category paths', async () => {
        const { service, categories } = setup();
        await service.preview({ buffer: Buffer.from(csv), originalname: 'a.csv', mimetype: 'text/csv' });
        expect(categories.getPublicTree).not.toHaveBeenCalled();
      });
    });

    it('rejects unsupported extensions and empty files with 400', async () => {
      const { service } = setup();
      await expect(
        service.preview({ buffer: Buffer.from(csv), originalname: 'a.xls', mimetype: 'application/vnd.ms-excel' }),
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        service.preview({ buffer: Buffer.alloc(0), originalname: 'a.csv', mimetype: 'text/csv' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('importProducts', () => {
    it('creates a DRAFT product with moq 0, re-hosted images and the seller price — never adminPrice', async () => {
      const { service, productsRepo, fetchImage, storage } = setup();
      const result = await service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] });

      expect(result.failed).toEqual([]);
      expect(result.created).toEqual([{ id: expect.any(String), name: 'Table Runner', slug: 'table-runner' }]);
      expect(fetchImage).toHaveBeenCalledTimes(2);
      expect(storage.uploadImage).toHaveBeenCalledWith(
        JPEG.buffer,
        expect.stringMatching(/-0-import\.jpg$/),
        expect.stringMatching(/^products\/table-runner--/),
      );

      const [sellerId, input, imageUrls, videoUrls, overrides] = vi.mocked(productsRepo.create).mock.calls[0];
      expect(sellerId).toBe(SELLER_ID);
      expect(input).toMatchObject({
        name: 'Table Runner',
        description: 'Hand woven',
        categoryId: CATEGORY_ID,
        materials: 'Cotton',
        moq: 0,
        declaredStock: 0,
        sellerPrice: 499,
        variants: undefined,
        slug: 'table-runner',
      });
      expect(input).not.toHaveProperty('adminPrice');
      expect(imageUrls).toEqual(['https://res.cloudinary.test/1.jpg', 'https://res.cloudinary.test/2.jpg']);
      expect(videoUrls).toEqual([]);
      expect(overrides).toEqual({ approvalStatus: ProductApprovalStatus.DRAFT });
      expect(input).not.toHaveProperty('brandId');
    });

    describe('marketplace brand sellers', () => {
      const BRAND_ID = '33333333-3333-3333-3333-333333333333';
      const brandCtx = (status: string) => ({ sellerType: 'MARKETPLACE', brand: { id: BRAND_ID, status } });

      it('creates a branded DRAFT with adminPrice = gross price and moq 1', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue(brandCtx('ACTIVE') as never);
        const result = await service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] });
        expect(result.failed).toEqual([]);
        const [, input, , , overrides] = vi.mocked(productsRepo.create).mock.calls[0];
        expect(input).toMatchObject({ moq: 1, sellerPrice: 499 });
        expect(overrides).toEqual({ approvalStatus: ProductApprovalStatus.DRAFT, brandId: BRAND_ID, adminPrice: 499 });
      });

      it('gives each variant tier an adminPrice equal to its price', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue(brandCtx('ACTIVE') as never);
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [
            candidate({
              variants: [
                { name: 'S', options: { Size: 'S' }, sku: null, sellerPrice: 300 },
                { name: 'L', options: { Size: 'L' }, sku: null, sellerPrice: 450 },
              ],
            }),
          ],
        });
        const [, input, , , overrides] = vi.mocked(productsRepo.create).mock.calls[0];
        expect(input.variants?.map((v) => v.priceTiers)).toEqual([
          [{ moq: 1, sellerPrice: 300, adminPrice: 300 }],
          [{ moq: 1, sellerPrice: 450, adminPrice: 450 }],
        ]);
        expect(overrides).toMatchObject({ brandId: BRAND_ID, adminPrice: 300 });
      });

      it('rejects imports for a suspended brand', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue(brandCtx('SUSPENDED') as never);
        await expect(
          service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] }),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(productsRepo.create).not.toHaveBeenCalled();
      });

      it('rejects a marketplace seller with no brand profile', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue({ sellerType: 'MARKETPLACE', brand: null } as never);
        await expect(
          service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] }),
        ).rejects.toMatchObject({ statusCode: 403 });
      });

      it('applies to admin-on-behalf imports too', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue(brandCtx('ACTIVE') as never);
        await service.importForAdmin('admin-1', SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] });
        expect(vi.mocked(productsRepo.create).mock.calls[0][4]).toMatchObject({ brandId: BRAND_ID });
      });
    });

    it('maps 2+ variants with attributes and price tiers; sellerPrice is the cheapest variant', async () => {
      const { service, productsRepo, repo } = setup();
      await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [
          candidate({
            sellerPrice: 999,
            variants: [
              { name: 'S / Red', options: { Size: 'S', Color: 'Red' }, sku: 'R-S', sellerPrice: 450 },
              { name: 'M / Red', options: { Size: 'M', Color: 'Red' }, sku: 'R-S', sellerPrice: 400 },
              { name: 'Free size', options: {}, sku: null, sellerPrice: null },
            ],
          }),
        ],
      });
      expect(repo.findExistingVariantSkus).toHaveBeenCalledWith(['R-S']);
      const input = vi.mocked(productsRepo.create).mock.calls[0][1];
      expect(input.sellerPrice).toBe(400);
      expect(input.variants).toEqual([
        {
          type: 'Size',
          value: 'S',
          sku: 'R-S',
          attributes: [
            { name: 'Size', value: 'S' },
            { name: 'Color', value: 'Red' },
          ],
          priceTiers: [{ moq: 1, sellerPrice: 450 }],
        },
        {
          type: 'Size',
          value: 'M',
          sku: undefined,
          attributes: [
            { name: 'Size', value: 'M' },
            { name: 'Color', value: 'Red' },
          ],
          priceTiers: [{ moq: 1, sellerPrice: 400 }],
        },
        { type: 'Option', value: 'Free size', sku: undefined, attributes: undefined, priceTiers: undefined },
      ]);
    });

    it('treats a single variant as a simple product and defaults missing price/description/materials', async () => {
      const { service, productsRepo } = setup();
      await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [
          candidate({
            sellerPrice: null,
            description: null,
            materials: null,
            imageUrls: [],
            variants: [{ name: 'Only', options: {}, sku: 'X', sellerPrice: 120 }],
          }),
          candidate({ key: 'b', name: 'No Price', sellerPrice: null, imageUrls: [] }),
        ],
      });
      const [first, second] = vi.mocked(productsRepo.create).mock.calls.map((c) => c[1]);
      expect(first).toMatchObject({ sellerPrice: 120, description: '', materials: '', variants: undefined });
      expect(second.sellerPrice).toBe(0);
    });

    it('re-strips HTML from the client-sent description', async () => {
      const { service, productsRepo } = setup();
      await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [candidate({ description: '<img src=x onerror=alert(1)>Nice <b>rug</b>' })],
      });
      expect(vi.mocked(productsRepo.create).mock.calls[0][1].description).toBe('Nice rug');
    });

    it('skips images that fail to fetch or upload', async () => {
      const { service, productsRepo, fetchImage, storage } = setup();
      vi.mocked(fetchImage).mockResolvedValueOnce(null);
      vi.mocked(storage.uploadImage).mockRejectedValueOnce(new Error('cloudinary down'));
      await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [candidate({ imageUrls: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'] })],
      });
      expect(vi.mocked(productsRepo.create).mock.calls[0][2]).toHaveLength(1);
    });

    it('generates a unique slug when the base slug is taken, and falls back for unsluggable names', async () => {
      const { service, productsRepo } = setup();
      vi.mocked(productsRepo.slugExists).mockResolvedValueOnce(true).mockResolvedValue(false);
      const result = await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [candidate(), candidate({ key: 'hindi', name: 'हस्तनिर्मित' })],
      });
      expect(result.created[0].slug).toMatch(/^table-runner-[a-z0-9]+$/);
      expect(result.created[1].slug).toBe('product');
    });

    it('one failing product does not abort the others', async () => {
      const { service, productsRepo, repo, storage } = setup();
      vi.mocked(repo.findExistingVariantSkus).mockImplementation((skus: string[]) =>
        Promise.resolve(skus.includes('TAKEN') ? ['TAKEN'] : []),
      );
      vi.mocked(productsRepo.create)
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }))
        .mockRejectedValueOnce(new Error('db exploded'));

      const twoVariants = (sku: string) => [
        { name: 'A', options: { Size: 'A' }, sku, sellerPrice: 1 },
        { name: 'B', options: { Size: 'B' }, sku: null, sellerPrice: 2 },
      ];
      const result = await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [
          candidate({ key: 'dup', name: 'Dup' }),
          candidate({ key: 'boom', name: 'Boom', imageUrls: [] }),
          candidate({ key: 'sku', name: 'Sku', variants: twoVariants('TAKEN') }),
          candidate({ key: 'ok', name: 'Fine' }),
        ],
      });

      expect(result.created.map((c) => c.name)).toEqual(['Fine']);
      expect(result.failed).toEqual([
        { key: 'dup', name: 'Dup', error: 'A product or variant SKU with these details already exists' },
        { key: 'boom', name: 'Boom', error: 'Could not create this product' },
        { key: 'sku', name: 'Sku', error: 'SKU already in use: TAKEN' },
      ]);
      // Uploads for the product whose create failed are cleaned up.
      expect(storage.deleteImage).toHaveBeenCalledWith('pub-1');
      expect(storage.deleteImage).toHaveBeenCalledWith('pub-2');
    });

    it('rejects the whole request when the category is not a valid leaf', async () => {
      const { service, categories, productsRepo } = setup();
      vi.mocked(categories.assertValidLeafCategory).mockRejectedValue(
        AppError.badRequest('Products must be assigned to a level 3 sub-subcategory'),
      );
      await expect(
        service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(productsRepo.create).not.toHaveBeenCalled();
    });

    describe('categories per product', () => {
      const OTHER = '44444444-4444-4444-4444-444444444444';

      it('a product category wins over the batch fallback; each distinct id is validated once', async () => {
        const { service, categories, productsRepo } = setup();
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [
            candidate({ key: 'a', name: 'A', categoryId: OTHER }),
            candidate({ key: 'b', name: 'B' }),
            candidate({ key: 'c', name: 'C', categoryId: OTHER }),
          ],
        });
        expect(vi.mocked(categories.assertValidLeafCategory).mock.calls.map((c) => c[0])).toEqual([CATEGORY_ID, OTHER]);
        expect(vi.mocked(productsRepo.create).mock.calls.map((c) => c[1].categoryId)).toEqual([OTHER, CATEGORY_ID, OTHER]);
      });

      it('works without a batch category when every product has its own', async () => {
        const { service, categories, productsRepo } = setup();
        const result = await service.importProducts(SELLER_ID, { products: [candidate({ categoryId: OTHER })] });
        expect(result.created).toHaveLength(1);
        expect(categories.assertValidLeafCategory).toHaveBeenCalledTimes(1);
        expect(vi.mocked(productsRepo.create).mock.calls[0][1].categoryId).toBe(OTHER);
      });

      it('a product with neither fails with a clear message and does not stop the others', async () => {
        const { service } = setup();
        const result = await service.importProducts(SELLER_ID, {
          products: [candidate({ key: 'x', name: 'No Cat' }), candidate({ key: 'y', name: 'Has Cat', categoryId: OTHER })],
        });
        expect(result.failed).toEqual([{ key: 'x', name: 'No Cat', error: 'Choose a category for this product' }]);
        expect(result.created.map((c) => c.name)).toEqual(['Has Cat']);
      });

      it('rejects the request when a per-product category is not a valid leaf', async () => {
        const { service, categories, productsRepo } = setup();
        vi.mocked(categories.assertValidLeafCategory).mockImplementation((id: string) =>
          id === OTHER ? Promise.reject(AppError.badRequest('Products must be assigned to a level 3 sub-subcategory')) : Promise.resolve({} as never),
        );
        await expect(
          service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate({ categoryId: OTHER })] }),
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(productsRepo.create).not.toHaveBeenCalled();
      });
    });

    describe('weight, dimensions, stock and tags', () => {
      it('passes product-level values to the create call', async () => {
        const { service, productsRepo } = setup();
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [candidate({ weightKg: 0.75, dimensions: '30 x 20 x 5 cm', stock: 25, tags: ['baby', 'cotton'] })],
        });
        expect(vi.mocked(productsRepo.create).mock.calls[0][1]).toMatchObject({
          weight: '0.75',
          dimensions: '30 x 20 x 5 cm',
          declaredStock: 25,
          tags: ['baby', 'cotton'],
        });
      });

      it('omits weight, dimensions and tags when absent, and defaults stock to 0', async () => {
        const { service, productsRepo } = setup();
        await service.importProducts(SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] });
        const input = vi.mocked(productsRepo.create).mock.calls[0][1];
        expect(input).not.toHaveProperty('weight');
        expect(input).not.toHaveProperty('dimensions');
        expect(input).not.toHaveProperty('tags');
        expect(input.declaredStock).toBe(0);
      });

      it('maps per-variant inventory, weight and dimensions; declaredStock is the sum; product weight is the first variant weight', async () => {
        const { service, productsRepo } = setup();
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [
            candidate({
              stock: 999,
              weightKg: 9,
              variants: [
                { name: 'S', options: { Size: 'S' }, sku: null, sellerPrice: 10, stock: 5 },
                {
                  name: 'M', options: { Size: 'M' }, sku: null, sellerPrice: 12, stock: 0, weightKg: 0.3,
                  dimensions: { length: 10, width: 8, height: 2, unit: 'in' },
                },
                { name: 'L', options: { Size: 'L' }, sku: null, sellerPrice: 14 },
              ],
            }),
          ],
        });
        const input = vi.mocked(productsRepo.create).mock.calls[0][1];
        expect(input.declaredStock).toBe(5);
        expect(input.weight).toBe('0.3');
        expect(input.variants?.map((v) => v.inventory)).toEqual([5, 0, undefined]);
        expect(input.variants?.[1]).toMatchObject({
          weight: 0.3,
          weightUnit: 'kg',
          length: 10,
          width: 8,
          height: 2,
          dimensionUnit: 'in',
        });
        expect(input.variants?.[0]).not.toHaveProperty('weight');
      });

      it('uses the candidate stock when no variant states inventory, and a lone variant stock for a single variant', async () => {
        const { service, productsRepo } = setup();
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [
            candidate({
              stock: 8,
              variants: [
                { name: 'A', options: {}, sku: null, sellerPrice: 1 },
                { name: 'B', options: {}, sku: null, sellerPrice: 2 },
              ],
            }),
            candidate({ key: 'solo', name: 'Solo', stock: 3, weightKg: 2, variants: [{ name: 'Only', options: {}, sku: null, sellerPrice: 5, stock: 11, weightKg: 1.5 }] }),
          ],
        });
        const [a, b] = vi.mocked(productsRepo.create).mock.calls.map((c) => c[1]);
        expect(a.declaredStock).toBe(8);
        expect(b).toMatchObject({ declaredStock: 11, weight: '1.5', variants: undefined });
      });

      it('brand drafts keep brand pricing and also carry the new fields', async () => {
        const { service, productsRepo } = setup();
        vi.mocked(productsRepo.findSellerContext).mockResolvedValue({ sellerType: 'MARKETPLACE', brand: { id: 'b1', status: 'ACTIVE' } } as never);
        await service.importProducts(SELLER_ID, {
          categoryId: CATEGORY_ID,
          products: [candidate({ weightKg: 1, stock: 4 })],
        });
        const [, input, , , overrides] = vi.mocked(productsRepo.create).mock.calls[0];
        expect(input).toMatchObject({ moq: 1, weight: '1', declaredStock: 4 });
        expect(overrides).toEqual({ approvalStatus: ProductApprovalStatus.DRAFT, brandId: 'b1', adminPrice: 499 });
      });
    });

    it('truncates a long list of taken SKUs in the error', async () => {
      const { service, repo } = setup();
      const taken = ['A', 'B', 'C', 'D', 'E', 'F'];
      vi.mocked(repo.findExistingVariantSkus).mockResolvedValue(taken);
      const result = await service.importProducts(SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [
          candidate({
            variants: taken.map((sku) => ({ name: sku, options: { Size: sku }, sku, sellerPrice: 1 })),
          }),
        ],
      });
      expect(result.failed[0].error).toBe('SKU already in use: A, B, C, D, E…');
    });
  });

  describe('importForSeller / importForAdmin', () => {
    it('resolves the seller profile from the authenticated user', async () => {
      const { service, sellers, productsRepo } = setup();
      await service.importForSeller('user-1', { categoryId: CATEGORY_ID, products: [candidate()] });
      expect(sellers.getMyProfile).toHaveBeenCalledWith('user-1');
      expect(vi.mocked(productsRepo.create).mock.calls[0][0]).toBe(SELLER_ID);
    });

    it('verifies the seller exists and writes an audit log entry for admin imports', async () => {
      const { service, sellers, audit } = setup();
      const result = await service.importForAdmin('admin-1', SELLER_ID, {
        categoryId: CATEGORY_ID,
        products: [candidate()],
      });
      expect(sellers.getSellerDetailForAdmin).toHaveBeenCalledWith(SELLER_ID);
      expect(audit).toHaveBeenCalledWith('admin-1', 'PRODUCTS_IMPORTED_BY_ADMIN', 'SellerProfile', SELLER_ID, {
        categoryId: CATEGORY_ID,
        requested: 1,
        createdProductIds: [result.created[0].id],
        failedKeys: [],
      });
    });

    it('404s for admin import when the seller does not exist, without auditing', async () => {
      const { service, sellers, audit } = setup();
      vi.mocked(sellers.getSellerDetailForAdmin).mockRejectedValue(AppError.notFound('Seller not found'));
      await expect(
        service.importForAdmin('admin-1', SELLER_ID, { categoryId: CATEGORY_ID, products: [candidate()] }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(audit).not.toHaveBeenCalled();
    });
  });
});
