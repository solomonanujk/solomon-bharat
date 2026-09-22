import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { sellersService } from '../sellers/sellers.service';
import { buyersService } from '../buyers/buyers.service';
import { productsService } from './products.service';
import {
  AdminProductListQueryDto,
  ApprovePricingChangeDto,
  ApproveProductDto,
  CreateProductAsAdminDto,
  CreateProductDto,
  PolishFieldDto,
  PublicProductListQueryDto,
  ReassignCategoryDto,
  RejectProductDto,
  SaveDraftDto,
  SellerProductListQueryDto,
  UpdatePriceDto,
  UpdateProductDto,
} from './products.validation';

function toFileInput(f: Express.Multer.File) {
  return { buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype };
}

// uploadProductMedia (middleware/upload.ts) uses multer's .fields(), so req.files is
// the object form { images?, videos? } rather than a flat array.
function extractFiles(req: Request): { images: ReturnType<typeof toFileInput>[]; videos: ReturnType<typeof toFileInput>[] } {
  const files = (req.files as { images?: Express.Multer.File[]; videos?: Express.Multer.File[] } | undefined) ?? {};
  return {
    images: (files.images ?? []).map(toFileInput),
    videos: (files.videos ?? []).map(toFileInput),
  };
}

async function resolveSellerProfileId(userId: string): Promise<string> {
  const profile = await sellersService.getMyProfile(userId);
  return profile.id;
}

async function resolveBuyerProfileId(userId: string): Promise<string> {
  const profile = await buyersService.getMyProfile(userId);
  return profile.id;
}

export const productsController = {
  async create(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const dto = req.body as CreateProductDto;
    const { images, videos } = extractFiles(req);
    const product = await productsService.createProduct(sellerProfileId, dto, images, videos);
    sendCreated(res, product, 'Product submitted for review');
  },

  async saveDraft(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const dto = req.body as SaveDraftDto;
    const product = await productsService.saveDraft(sellerProfileId, dto);
    sendCreated(res, product, 'Draft saved');
  },

  async createAsAdmin(req: Request, res: Response): Promise<void> {
    const { sellerMode, sellerId, ...dto } = req.body as CreateProductAsAdminDto;
    const { images, videos } = extractFiles(req);
    const product = await productsService.createProductAsAdmin(
      sellerMode,
      sellerId,
      dto,
      images,
      req.user!.id,
      videos,
    );
    sendCreated(res, product, 'Product created and published');
  },

  async update(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const dto = req.body as UpdateProductDto;
    const { images, videos } = extractFiles(req);
    const product = await productsService.updateProduct(sellerProfileId, req.params.id, dto, images, videos);
    sendSuccess(res, product, 'Product updated');
  },

  async resubmit(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const product = await productsService.resubmitProduct(sellerProfileId, req.params.id);
    sendSuccess(res, product, 'Product resubmitted for review');
  },

  async remove(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    await productsService.deleteProduct(sellerProfileId, req.params.id);
    sendSuccess(res, null, 'Product deleted');
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const { approvalStatus, ...pagination } = req.query as unknown as SellerProductListQueryDto;
    const { data, total } = await productsService.listForSeller(sellerProfileId, { approvalStatus }, pagination);
    sendSuccess(res, data, 'Products retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getMine(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const product = await productsService.getForSeller(sellerProfileId, req.params.id);
    sendSuccess(res, product);
  },

  async approve(req: Request, res: Response): Promise<void> {
    const dto = req.body as ApproveProductDto;
    const product = await productsService.approveProduct(req.params.id, dto.priceTiers, dto.variantPriceTiers, req.user!.id);
    sendSuccess(res, product, 'Product approved and published');
  },

  async reject(req: Request, res: Response): Promise<void> {
    const dto = req.body as RejectProductDto;
    const product = await productsService.rejectProduct(req.params.id, dto.reason, req.user!.id);
    sendSuccess(res, product, 'Product rejected');
  },

  async updatePrice(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdatePriceDto;
    const product = await productsService.updatePrice(req.params.id, dto.priceTiers, dto.variantPriceTiers, req.user!.id);
    sendSuccess(res, product, 'Selling price updated');
  },

  async reassignCategory(req: Request, res: Response): Promise<void> {
    const dto = req.body as ReassignCategoryDto;
    const product = await productsService.reassignCategory(req.params.id, dto.categoryId, req.user!.id);
    sendSuccess(res, product, 'Product reassigned to new category');
  },

  async updateAdmin(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateProductDto;
    const { images, videos } = extractFiles(req);
    const product = await productsService.updateProductAsAdmin(req.params.id, dto, images, req.user!.id, videos);
    sendSuccess(res, product, 'Product updated');
  },

  async listPendingPricingChanges(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await productsService.listPendingPricingChanges(pagination);
    sendSuccess(res, data, 'Pending pricing changes retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async approvePricingChange(req: Request, res: Response): Promise<void> {
    const dto = req.body as ApprovePricingChangeDto;
    const product = await productsService.approvePricingChange(
      req.params.id,
      dto.priceTiers,
      dto.variantPriceTiers,
      req.user!.id,
    );
    sendSuccess(res, product, 'Pricing change approved');
  },

  async rejectPricingChange(req: Request, res: Response): Promise<void> {
    const dto = req.body as RejectProductDto;
    await productsService.rejectPricingChange(req.params.id, dto.reason, req.user!.id);
    sendSuccess(res, null, 'Pricing change rejected');
  },

  async publish(req: Request, res: Response): Promise<void> {
    const product = await productsService.setPublished(req.params.id, true);
    sendSuccess(res, product, 'Product published');
  },

  async unpublish(req: Request, res: Response): Promise<void> {
    const product = await productsService.setPublished(req.params.id, false);
    sendSuccess(res, product, 'Product unpublished');
  },

  async feature(req: Request, res: Response): Promise<void> {
    const product = await productsService.setFeatured(req.params.id, true);
    sendSuccess(res, product, 'Product featured');
  },

  async unfeature(req: Request, res: Response): Promise<void> {
    const product = await productsService.setFeatured(req.params.id, false);
    sendSuccess(res, product, 'Product unfeatured');
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { approvalStatus, sellerId, categoryId, ...pagination } =
      req.query as unknown as AdminProductListQueryDto;
    const { data, total } = await productsService.listForAdmin(
      { approvalStatus, sellerId, categoryId },
      pagination,
    );
    sendSuccess(res, data, 'Products retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getAdmin(req: Request, res: Response): Promise<void> {
    const product = await productsService.getForAdmin(req.params.id);
    sendSuccess(res, product);
  },

  async listPublic(req: Request, res: Response): Promise<void> {
    const {
      categoryId, collectionId, search, sort, material, minPrice, maxPrice, moqMax,
      placeOfOrigin, leadTime, ...pagination
    } = req.query as unknown as PublicProductListQueryDto;
    const { data, total } = await productsService.listPublished(
      { categoryId, collectionId, search, sort, material, minPrice, maxPrice, moqMax, placeOfOrigin, leadTime },
      pagination,
      req.user?.role,
    );
    sendSuccess(res, data, 'Products retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const result = await productsService.getBySlug(req.params.slug, req.user?.role);
    sendSuccess(res, result);
  },

  async listPlaceOfOriginFacets(_req: Request, res: Response): Promise<void> {
    const values = await productsService.listPlaceOfOriginFacets();
    sendSuccess(res, values);
  },

  async listRecommended(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await productsService.getRecommendationsForBuyer(buyerId, pagination, req.user!.role);
    sendSuccess(res, data, 'Recommendations retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async polish(req: Request, res: Response): Promise<void> {
    const { field, value } = req.body as PolishFieldDto;
    const cleaned = await productsService.polishField(field, value);
    sendSuccess(res, { cleaned });
  },
};
