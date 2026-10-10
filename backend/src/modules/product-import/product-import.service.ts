import { randomUUID } from 'crypto';
import { Prisma, ProductApprovalStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { logger } from '../../config/logger';
import { writeAuditLog } from '../../utils/auditLog';
import { entityFolder, slugify, uniqueSlugSuffix } from '../../utils/helpers';
import { spreadsheetKindFromFilename } from '../../middleware/upload';
import { storageProvider, StorageProvider, UploadedImage } from '../../providers/storage';
import { categoriesService, CategoriesService } from '../categories/categories.service';
import { productsRepository, ProductsRepository } from '../products/products.repository';
import { CreateProductInput, VariantInputWithAdminPricing } from '../products/products.types';
import { sellersService, SellersService } from '../sellers/sellers.service';
import { parseProductSpreadsheet, stripHtml } from './parsers';
import { fetchRemoteImage, FetchedImage } from './product-import.images';
import { productImportRepository, ProductImportRepository } from './product-import.repository';
import {
  ImportCandidate,
  ImportCandidateVariant,
  ImportProductsInput,
  ProductImportPreview,
  ProductImportResult,
  SpreadsheetFile,
} from './product-import.types';

type SellerLookup = Pick<SellersService, 'getMyProfile' | 'getSellerDetailForAdmin'>;
type ImageFetcher = (url: string) => Promise<FetchedImage | null>;
type AuditWriter = typeof writeAuditLog;

/** Expected per-product failure — its message is safe to show the user. */
class ImportProductError extends Error {}

export class ProductImportService {
  constructor(
    private readonly repo: ProductImportRepository = productImportRepository,
    private readonly productsRepo: ProductsRepository = productsRepository,
    private readonly categories: CategoriesService = categoriesService,
    private readonly sellers: SellerLookup = sellersService,
    private readonly fetchImage: ImageFetcher = fetchRemoteImage,
    private readonly storage: StorageProvider = storageProvider,
    private readonly audit: AuditWriter = writeAuditLog,
  ) {}

  // ── Seller resolution ───────────────────────────────────────────────

  private async ownSellerProfileId(userId: string): Promise<string> {
    return (await this.sellers.getMyProfile(userId)).id;
  }

  /** 404s when the seller profile doesn't exist. */
  private async assertSellerExists(sellerProfileId: string): Promise<void> {
    await this.sellers.getSellerDetailForAdmin(sellerProfileId);
  }

  // ── Preview ─────────────────────────────────────────────────────────

  async preview(file: SpreadsheetFile): Promise<ProductImportPreview> {
    const kind = spreadsheetKindFromFilename(file.originalname);
    if (!kind) throw AppError.badRequest('Upload a .csv or .xlsx spreadsheet');
    if (file.buffer.length === 0) throw AppError.badRequest('The uploaded file is empty');
    return parseProductSpreadsheet(file.buffer, kind);
  }

  async previewForSeller(userId: string, file: SpreadsheetFile): Promise<ProductImportPreview> {
    await this.ownSellerProfileId(userId);
    return this.preview(file);
  }

  async previewForAdmin(sellerProfileId: string, file: SpreadsheetFile): Promise<ProductImportPreview> {
    await this.assertSellerExists(sellerProfileId);
    return this.preview(file);
  }

  // ── Import ──────────────────────────────────────────────────────────

  async importForSeller(userId: string, input: ImportProductsInput): Promise<ProductImportResult> {
    const sellerProfileId = await this.ownSellerProfileId(userId);
    return this.importProducts(sellerProfileId, input);
  }

  async importForAdmin(adminId: string, sellerProfileId: string, input: ImportProductsInput): Promise<ProductImportResult> {
    await this.assertSellerExists(sellerProfileId);
    const result = await this.importProducts(sellerProfileId, input);
    await this.audit(adminId, 'PRODUCTS_IMPORTED_BY_ADMIN', 'SellerProfile', sellerProfileId, {
      categoryId: input.categoryId,
      requested: input.products.length,
      createdProductIds: result.created.map((p) => p.id),
      failedKeys: result.failed.map((f) => f.key),
    });
    return result;
  }

  /**
   * Creates one DRAFT product per candidate. Products are processed one at a time
   * (slug generation checks the DB, so parallel creates of same-named products could
   * race); one product failing never aborts the rest.
   */
  async importProducts(sellerProfileId: string, input: ImportProductsInput): Promise<ProductImportResult> {
    await this.categories.assertValidLeafCategory(input.categoryId);

    const result: ProductImportResult = { created: [], failed: [] };
    for (const candidate of input.products) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const created = await this.importOne(sellerProfileId, input.categoryId, candidate);
        result.created.push(created);
      } catch (err) {
        logger.warn({ err, key: candidate.key, sellerProfileId }, 'Product import: product failed');
        result.failed.push({ key: candidate.key, name: candidate.name, error: this.describeError(err) });
      }
    }
    return result;
  }

  private describeError(err: unknown): string {
    if (err instanceof ImportProductError || err instanceof AppError) return err.message;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'A product or variant SKU with these details already exists';
    }
    return 'Could not create this product';
  }

  private async importOne(
    sellerProfileId: string,
    categoryId: string,
    candidate: ImportCandidate,
  ): Promise<{ id: string; name: string; slug: string }> {
    const name = candidate.name.trim();
    const variants = this.mapVariants(candidate.variants);

    const skus = (variants ?? []).map((v) => v.sku).filter((s): s is string => !!s);
    const taken = await this.repo.findExistingVariantSkus(skus);
    if (taken.length > 0) {
      throw new ImportProductError(`SKU already in use: ${taken.slice(0, 5).join(', ')}${taken.length > 5 ? '…' : ''}`);
    }

    const slug = await this.generateUniqueSlug(name);
    const id = randomUUID();
    const folder = entityFolder('products', slug, id);
    const uploads = await this.importImages(candidate.imageUrls, folder);

    const createInput: CreateProductInput = {
      name,
      // Already plain text from the preview — re-stripped since the body is client-sent.
      description: candidate.description ? stripHtml(candidate.description) : '',
      categoryId,
      materials: candidate.materials?.trim() ?? '',
      // The seller completes MOQ (and the rest) before submitting the draft for review.
      moq: 0,
      declaredStock: 0,
      sellerPrice: this.cheapestPrice(candidate),
      variants,
    };

    try {
      const created = await this.productsRepo.create(
        sellerProfileId,
        { ...createInput, slug, id },
        uploads.map((u) => u.url),
        [],
        { approvalStatus: ProductApprovalStatus.DRAFT },
      );
      return { id: created.id, name: created.name, slug: created.slug };
    } catch (err) {
      // Don't leave orphaned uploads behind for a product that was never created.
      await Promise.all(uploads.map((u) => this.storage.deleteImage(u.publicId).catch(() => undefined)));
      throw err;
    }
  }

  /** sellerPrice = cheapest variant price, else the product's own price, else 0
   *  (Product.sellerPrice is required; the seller fills it in on the draft). Never adminPrice. */
  private cheapestPrice(candidate: ImportCandidate): number {
    const prices = candidate.variants.map((v) => v.sellerPrice).filter((p): p is number => p !== null);
    if (prices.length > 0) return Math.min(...prices);
    return candidate.sellerPrice ?? 0;
  }

  /** Only 2+ variants map onto this platform's variant model — a single variant is
   *  just the product itself. SKUs repeated within the product are dropped. */
  private mapVariants(variants: ImportCandidateVariant[]): VariantInputWithAdminPricing[] | undefined {
    if (variants.length <= 1) return undefined;
    const seenSkus = new Set<string>();
    return variants.map((v) => {
      const attributes = Object.entries(v.options)
        .map(([attrName, value]) => ({ name: attrName.trim(), value: value.trim() }))
        .filter((a) => a.name && a.value);
      const primary = attributes[0] ?? { name: 'Option', value: v.name.trim() };
      let sku = v.sku?.trim() || undefined;
      if (sku && seenSkus.has(sku)) sku = undefined;
      if (sku) seenSkus.add(sku);
      return {
        type: primary.name,
        value: primary.value,
        sku,
        attributes: attributes.length ? attributes : undefined,
        priceTiers: v.sellerPrice !== null ? [{ moq: 1, sellerPrice: v.sellerPrice }] : undefined,
      };
    });
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'product';
    let slug = base;
    // eslint-disable-next-line no-await-in-loop
    while (await this.productsRepo.slugExists(slug)) {
      slug = `${base}-${uniqueSlugSuffix()}`;
    }
    return slug;
  }

  /** Fetches each image and re-uploads it to our storage, preserving order. Failed
   *  images (unreachable, not an image, too big, upload error) are skipped. */
  private async importImages(urls: string[], folder: string): Promise<UploadedImage[]> {
    const results = await Promise.all(
      urls.map(async (url, index): Promise<UploadedImage | null> => {
        const image = await this.fetchImage(url);
        if (!image) return null;
        try {
          return await this.storage.uploadImage(image.buffer, `${Date.now()}-${index}-import.${image.extension}`, folder);
        } catch (err) {
          logger.warn({ err, url }, 'Product import: image upload failed, skipping');
          return null;
        }
      }),
    );
    return results.filter((r): r is UploadedImage => r !== null);
  }
}

export const productImportService = new ProductImportService();
