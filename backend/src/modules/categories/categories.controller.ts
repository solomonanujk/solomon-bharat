import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { categoriesService } from './categories.service';
import { CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto } from './categories.validation';

function extractHeroImageFile(req: Request) {
  const file = req.file as Express.Multer.File | undefined;
  return file ? { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype } : undefined;
}

export const categoriesController = {
  async getPublicTree(_req: Request, res: Response): Promise<void> {
    const tree = await categoriesService.getPublicTree();
    sendSuccess(res, tree);
  },

  async getAdminTree(_req: Request, res: Response): Promise<void> {
    const tree = await categoriesService.getAdminTree();
    sendSuccess(res, tree);
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const includeArchived = req.user?.role === 'SUPER_ADMIN';
    const category = await categoriesService.getCategoryDetailBySlug(req.params.slug, includeArchived);
    sendSuccess(res, category);
  },

  async create(req: Request, res: Response): Promise<void> {
    const dto = req.body as CreateCategoryDto;
    const category = await categoriesService.createCategory(dto, extractHeroImageFile(req));
    sendCreated(res, category, 'Category created');
  },

  async update(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateCategoryDto;
    const category = await categoriesService.updateCategory(req.params.id, dto, extractHeroImageFile(req));
    sendSuccess(res, category, 'Category updated');
  },

  async archive(req: Request, res: Response): Promise<void> {
    const category = await categoriesService.archiveCategory(req.params.id);
    sendSuccess(res, category, 'Category archived');
  },

  async restore(req: Request, res: Response): Promise<void> {
    const category = await categoriesService.restoreCategory(req.params.id);
    sendSuccess(res, category, 'Category restored');
  },

  async reorder(req: Request, res: Response): Promise<void> {
    const dto = req.body as ReorderCategoriesDto;
    await categoriesService.reorderSiblings(dto);
    sendSuccess(res, null, 'Categories reordered');
  },
};
