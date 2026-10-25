import { Request, Response } from 'express';
import { PaginationQuery, buildPaginationMeta } from '../../utils/pagination';
import { sendSuccess } from '../../utils/response';
import { whatsAppAdminService } from './whatsapp.admin.service';
import { AdminProductsQueryDto, AdminSellersQueryDto } from './whatsapp.admin.validation';

export const whatsAppAdminController = {
  async summary(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await whatsAppAdminService.summary());
  },

  async products(req: Request, res: Response): Promise<void> {
    const { approvalStatus, sellerId, ...pagination } = req.query as unknown as AdminProductsQueryDto;
    const { data, total } = await whatsAppAdminService.products({ approvalStatus, sellerId }, pagination);
    sendSuccess(res, data, 'WhatsApp products retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async sessions(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await whatsAppAdminService.liveListings(pagination);
    sendSuccess(res, data, 'Listings in progress retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async sellers(req: Request, res: Response): Promise<void> {
    const { search, ...pagination } = req.query as unknown as AdminSellersQueryDto;
    const { data, total } = await whatsAppAdminService.linkedSellers({ search }, pagination);
    sendSuccess(res, data, 'Linked sellers retrieved', 200, buildPaginationMeta(total, pagination));
  },
};
