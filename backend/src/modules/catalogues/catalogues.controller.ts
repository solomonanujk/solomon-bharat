import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { cataloguesService } from './catalogues.service';
import { CreateCatalogueDto } from './catalogues.validation';

export const cataloguesController = {
  async generate(req: Request, res: Response): Promise<void> {
    const dto = req.body as CreateCatalogueDto;
    const catalogue = await cataloguesService.generate(req.user!.id, dto);
    sendCreated(res, catalogue, 'Catalogue generated');
  },

  async list(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await cataloguesService.listMine(req.user!.id, pagination);
    sendSuccess(res, data, 'Catalogues retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const catalogue = await cataloguesService.getMine(req.user!.id, req.params.id);
    sendSuccess(res, catalogue);
  },
};
