import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { brandsService } from './brands.service';
import {
  AdminBrandListQueryDto,
  AdminUpdateBrandDto,
  BrandListQueryDto,
  CommissionDefaultsDto,
  UpdateOwnBrandDto,
} from './brands.validation';

function toViewer(req: Request) {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

export const brandsController = {
  async list(req: Request, res: Response): Promise<void> {
    const { search, ...pagination } = req.query as unknown as BrandListQueryDto;
    const { data, total } = await brandsService.listPublic(search, pagination);
    sendSuccess(res, data, 'Brands retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const brand = await brandsService.getPublicBySlug(req.params.slug, toViewer(req));
    sendSuccess(res, brand);
  },

  async follow(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.follow(req.user!.id, req.params.slug), 'Brand followed');
  },

  async unfollow(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.unfollow(req.user!.id, req.params.slug), 'Brand unfollowed');
  },

  async following(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as { page: number; limit: number };
    const { data, total } = await brandsService.listFollowing(req.user!.id, pagination);
    sendSuccess(res, data, 'Followed brands retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getMine(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.getMyBrand(req.user!.id));
  },

  async updateMine(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateOwnBrandDto;
    sendSuccess(res, await brandsService.updateMyBrand(req.user!.id, dto), 'Brand updated');
  },

  async uploadLogo(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.uploadMyBrandImage(req.user!.id, 'logo', req.file), 'Logo uploaded');
  },

  async uploadBanner(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.uploadMyBrandImage(req.user!.id, 'banner', req.file), 'Banner uploaded');
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.getMyStats(req.user!.id));
  },

  async adminList(req: Request, res: Response): Promise<void> {
    const { status, search, ...pagination } = req.query as unknown as AdminBrandListQueryDto;
    const { data, total } = await brandsService.listForAdmin({ status, search }, pagination);
    sendSuccess(res, data, 'Brands retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async adminUpdate(req: Request, res: Response): Promise<void> {
    const dto = req.body as AdminUpdateBrandDto;
    sendSuccess(res, await brandsService.updateForAdmin(req.user!.id, req.params.id, dto), 'Brand updated');
  },

  async getCommissionDefaults(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await brandsService.getCommissionDefaults());
  },

  async setCommissionDefaults(req: Request, res: Response): Promise<void> {
    const dto = req.body as CommissionDefaultsDto;
    sendSuccess(res, await brandsService.setCommissionDefaults(req.user!.id, dto), 'Commission defaults updated');
  },
};
