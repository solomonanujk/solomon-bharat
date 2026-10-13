import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { rfqsService } from './rfqs.service';
import { AdminRfqListQueryDto, CreateRfqDto, UpdateRfqDto } from './rfqs.validation';

export const rfqsController = {
  async create(req: Request, res: Response): Promise<void> {
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
    }));
    const rfq = await rfqsService.create(req.user!.id, req.body as CreateRfqDto, files);
    sendCreated(res, rfq, 'Request received. Our team will get back to you shortly.');
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await rfqsService.listMine(req.user!.id, pagination);
    sendSuccess(res, data, 'Requests retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { status, ...pagination } = req.query as unknown as AdminRfqListQueryDto;
    const { data, total } = await rfqsService.listForAdmin(status, pagination);
    sendSuccess(res, data, 'Requests retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await rfqsService.update(req.user!.id, req.params.id, req.body as UpdateRfqDto), 'Request updated');
  },
};
