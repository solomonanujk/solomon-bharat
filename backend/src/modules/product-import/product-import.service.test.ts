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
    create: vi.fn().mockImplementation((_sellerId: string, input: { id: string; name: string; slug: string }) =>
      Promise.resolve({ id: input.id, name: input.name, slug: input.slug }),
    ),
  } as unknown as ProductsRepository;
  const categories = { assertValidLeafCategory: vi.fn().mockResolvedValue({ id: CATEGORY_ID, level: 3 }) } as unknown as CategoriesService;
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
