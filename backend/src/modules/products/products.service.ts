import { Product, ProductApprovalStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { slugify, uniqueSlugSuffix, calculateMargin } from '../../utils/helpers';
import { writeAuditLog } from '../../utils/auditLog';
import { storageProvider } from '../../providers/storage';
import { PaginationQuery } from '../../utils/pagination';
import { cache as defaultCache, bumpVersion, CacheClient, versionedListKey } from '../../utils/cache';
import { prisma } from '../../config/prisma';
import { categoriesService, CategoriesService } from '../categories/categories.service';
import { notificationsService } from '../notifications/notifications.service';
import { ProductsRepository, productsRepository } from './products.repository';
import {
  AdminProductListFilter,
  BuyerProduct,
  CreateProductInput,
  ProductListFilter,
  ProductWithMedia,
  SellerProduct,
  SellerProductListFilter,
  UpdateProductInput,
  UploadedImageFile,
} from './products.types';

const MIN_IMAGES = 2;
const MAX_IMAGES = 10;

const OPEN_REVIEW_STATUSES: ProductApprovalStatus[] = [
  ProductApprovalStatus.PENDING,
  ProductApprovalStatus.RESUBMITTED,
];

function toBuyerProduct(product: ProductWithMedia): BuyerProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    materials: product.materials,
    dimensions: product.dimensions,
    weight: product.weight,
    moq: product.moq,
    adminPrice: product.adminPrice ? product.adminPrice.toString() : '0',
    leadTime: product.leadTime,
    certifications: product.certifications,
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    publishedAt: product.publishedAt,
    images: product.images,
    variants: product.variants,
  };
}

function toSellerProduct(product: ProductWithMedia): SellerProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    materials: product.materials,
    dimensions: product.dimensions,
    weight: product.weight,
    moq: product.moq,
    declaredStock: product.declaredStock,
    sellerPrice: product.sellerPrice.toString(),
    leadTime: product.leadTime,
    certifications: product.certifications,
    categoryId: product.categoryId,
    approvalStatus: product.approvalStatus,
    rejectionReason: product.rejectionReason,
    isPublished: product.isPublished,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    images: product.images,
    variants: product.variants,
  };
}

const PUBLISHED_LIST_CACHE_NAMESPACE = 'products:published-list';
const PUBLISHED_LIST_CACHE_TTL_SECONDS = 120;

export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository = productsRepository,
    private readonly categories: CategoriesService = categoriesService,
    private readonly cache: CacheClient = defaultCache,
  ) {}

  private async invalidatePublishedListCache(): Promise<void> {
    await bumpVersion(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE);
  }

  /**
   * Internal, service-to-service only — returns raw seller+admin pricing together so the
   * orders module can compute per-line margins at checkout. Never routed via a controller;
   * every public-facing method on this class strips one side or the other.
   */
  async getForCheckout(productId: string): Promise<Product> {
    return this.getProductOrThrow(productId);
  }

  private async getOwnedProductOrThrow(sellerProfileId: string, productId: string): Promise<Product> {
    const product = await this.repo.findByIdRaw(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    if (product.sellerId !== sellerProfileId) {
      throw AppError.forbidden('You do not have access to this product');
    }
    return product;
  }

  private async getProductOrThrow(productId: string): Promise<Product> {
    const product = await this.repo.findByIdRaw(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    return product;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    // eslint-disable-next-line no-await-in-loop
    while (await this.repo.slugExists(slug)) {
      slug = `${base}-${uniqueSlugSuffix()}`;
    }
    return slug;
  }

  private async uploadImages(files: UploadedImageFile[]): Promise<string[]> {
    const uploads = await Promise.all(
      files.map((file, index) =>
        storageProvider.uploadImage(file.buffer, `${Date.now()}-${index}-${file.originalname}`, 'products'),
      ),
    );
    return uploads.map((u) => u.url);
  }

  async createProduct(
    sellerProfileId: string,
    input: CreateProductInput,
    files: UploadedImageFile[],
  ): Promise<SellerProduct> {
    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    await this.categories.assertValidLeafCategory(input.categoryId);

    const slug = await this.generateUniqueSlug(input.name);
    const imageUrls = await this.uploadImages(files);

    const product = await this.repo.create(sellerProfileId, { ...input, slug }, imageUrls);
    await this.invalidatePublishedListCache();
    return toSellerProduct(product);
  }

  async updateProduct(
    sellerProfileId: string,
    productId: string,
    input: UpdateProductInput,
    files: UploadedImageFile[],
  ): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);

    if (product.approvalStatus === ProductApprovalStatus.APPROVED) {
      throw AppError.badRequest('An approved product cannot be edited directly — contact support');
    }

    const withMedia = await this.repo.findByIdWithMedia(productId);
    const currentImageCount = withMedia?.images.length ?? 0;
    const removedCount = input.removeImageIds?.length ?? 0;
    const finalImageCount = currentImageCount - removedCount + files.length;

    if (finalImageCount < MIN_IMAGES || finalImageCount > MAX_IMAGES) {
      throw AppError.badRequest(`Products require between ${MIN_IMAGES} and ${MAX_IMAGES} images`);
    }

    const imageUrls = await this.uploadImages(files);
    const updated = await this.repo.update(productId, input, imageUrls, currentImageCount - removedCount);
    await this.invalidatePublishedListCache();
    return toSellerProduct(updated);
  }

  async resubmitProduct(sellerProfileId: string, productId: string): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);

    if (product.approvalStatus !== ProductApprovalStatus.REJECTED) {
      throw AppError.badRequest('Only a rejected product can be resubmitted');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.RESUBMITTED,
      rejectionReason: null,
    });
    await this.invalidatePublishedListCache();
    const withMedia = await this.repo.findByIdWithMedia(updated.id);
    return toSellerProduct(withMedia as ProductWithMedia);
  }

  async deleteProduct(sellerProfileId: string, productId: string): Promise<void> {
    await this.getOwnedProductOrThrow(sellerProfileId, productId);
    await this.repo.softDelete(productId);
    await this.invalidatePublishedListCache();
  }

  async approveProduct(productId: string, adminPrice: number, adminId: string): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (!OPEN_REVIEW_STATUSES.includes(product.approvalStatus)) {
      throw AppError.badRequest('Only a pending or resubmitted product can be approved');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.APPROVED,
      adminPrice,
      rejectionReason: null,
      isPublished: true,
      publishedAt: new Date(),
    });

    await writeAuditLog(adminId, 'PRODUCT_APPROVED', 'Product', productId, { adminPrice });
    await this.invalidatePublishedListCache();

    const sellerUserId = await this.getSellerUserId(updated.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyProductApproved(sellerUserId, updated.name);
    }

    return updated;
  }

  private async getSellerUserId(sellerProfileId: string): Promise<string | null> {
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerProfileId },
      select: { userId: true },
    });
    return seller?.userId ?? null;
  }

  async rejectProduct(productId: string, reason: string, adminId: string): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (!OPEN_REVIEW_STATUSES.includes(product.approvalStatus)) {
      throw AppError.badRequest('Only a pending or resubmitted product can be rejected');
    }

    const updated = await this.repo.setApproval(productId, {
      approvalStatus: ProductApprovalStatus.REJECTED,
      rejectionReason: reason,
      isPublished: false,
    });

    await writeAuditLog(adminId, 'PRODUCT_REJECTED', 'Product', productId, { reason });
    await this.invalidatePublishedListCache();

    const sellerUserId = await this.getSellerUserId(updated.sellerId);
    if (sellerUserId) {
      await notificationsService.notifyProductRejected(sellerUserId, updated.name, reason);
    }

    return updated;
  }

  async updatePrice(productId: string, adminPrice: number, adminId: string): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.badRequest('Only an approved product has a selling price to update');
    }

    const updated = await this.repo.setApproval(productId, { adminPrice });
    await writeAuditLog(adminId, 'PRODUCT_PRICE_CHANGED', 'Product', productId, {
      previousPrice: product.adminPrice?.toString(),
      newPrice: adminPrice,
    });
    await this.invalidatePublishedListCache();
    return updated;
  }

  async reassignCategory(productId: string, categoryId: string, adminId: string): Promise<Product> {
    await this.getProductOrThrow(productId);
    await this.categories.assertValidLeafCategory(categoryId);

    const updated = await this.repo.setCategory(productId, categoryId);
    await writeAuditLog(adminId, 'PRODUCT_CATEGORY_REASSIGNED', 'Product', productId, { categoryId });
    await this.invalidatePublishedListCache();
    return updated;
  }

  async setPublished(productId: string, isPublished: boolean): Promise<Product> {
    const product = await this.getProductOrThrow(productId);
    if (isPublished && (product.approvalStatus !== ProductApprovalStatus.APPROVED || !product.adminPrice)) {
      throw AppError.badRequest('Only an approved product with a selling price can be published');
    }
    const updated = await this.repo.setPublished(productId, isPublished);
    await this.invalidatePublishedListCache();
    return updated;
  }

  async setFeatured(productId: string, isFeatured: boolean): Promise<Product> {
    await this.getProductOrThrow(productId);
    const updated = await this.repo.setFeatured(productId, isFeatured);
    await this.invalidatePublishedListCache();
    return updated;
  }

  async listPublished(filter: ProductListFilter, pagination: PaginationQuery) {
    if (!filter.categoryId && !filter.collectionId) {
      throw AppError.badRequest('A category or collection scope is required for product search');
    }

    const key = await versionedListKey(this.cache, PUBLISHED_LIST_CACHE_NAMESPACE, {
      ...filter,
      ...pagination,
    });
    const cached = await this.cache.get<{ data: BuyerProduct[]; total: number }>(key);
    if (cached) return cached;

    const categoryIds = filter.categoryId
      ? await this.categories.getLeafDescendantIds(filter.categoryId)
      : undefined;

    const { data, total } = await this.repo.findPublished(filter, pagination, categoryIds);
    const result = { data: data.map(toBuyerProduct), total };
    await this.cache.set(key, result, PUBLISHED_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async getBySlug(slug: string): Promise<{ product: BuyerProduct; related: BuyerProduct[] }> {
    const product = await this.repo.findBySlugWithMedia(slug);
    if (!product || product.deletedAt || !product.isPublished || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw AppError.notFound('Product not found');
    }

    const related = await this.repo.findRelated(product.categoryId, product.id, 4);
    return { product: toBuyerProduct(product), related: related.map(toBuyerProduct) };
  }

  async listForSeller(
    sellerProfileId: string,
    filter: SellerProductListFilter,
    pagination: PaginationQuery,
  ) {
    const { data, total } = await this.repo.findForSeller(sellerProfileId, filter, pagination);
    return { data: data.map(toSellerProduct), total };
  }

  async listForAdmin(filter: AdminProductListFilter, pagination: PaginationQuery) {
    const { data, total } = await this.repo.findForAdmin(filter, pagination);
    return {
      data: data.map((product) => ({
        ...product,
        sellerPrice: product.sellerPrice.toString(),
        adminPrice: product.adminPrice ? product.adminPrice.toString() : null,
        margin: product.adminPrice
          ? calculateMargin(Number(product.adminPrice), Number(product.sellerPrice))
          : null,
      })),
      total,
    };
  }

  async getForSeller(sellerProfileId: string, productId: string): Promise<SellerProduct> {
    const product = await this.getOwnedProductOrThrow(sellerProfileId, productId);
    const withMedia = await this.repo.findByIdWithMedia(product.id);
    return toSellerProduct(withMedia as ProductWithMedia);
  }

  async getForAdmin(productId: string) {
    const product = await this.repo.findByIdWithMedia(productId);
    if (!product || product.deletedAt) {
      throw AppError.notFound('Product not found');
    }
    return {
      ...product,
      sellerPrice: product.sellerPrice.toString(),
      adminPrice: product.adminPrice ? product.adminPrice.toString() : null,
      margin: product.adminPrice
        ? calculateMargin(Number(product.adminPrice), Number(product.sellerPrice))
        : null,
    };
  }
}

export const productsService = new ProductsService();
