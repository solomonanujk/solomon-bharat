import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { sellersService } from './sellers.service';
import {
  AddNoteDto,
  ApplicationListQueryDto,
  RejectApplicationDto,
  RequestMoreInfoDto,
  SubmitApplicationDto,
  UpdateSellerProfileDto,
} from './sellers.validation';

export const sellersController = {
  async submitApplication(req: Request, res: Response): Promise<void> {
    const dto = req.body as SubmitApplicationDto;
    const application = await sellersService.submitApplication(dto);
    sendCreated(res, application, 'Application submitted. We will be in touch shortly.');
  },

  async listApplications(req: Request, res: Response): Promise<void> {
    const { status, ...pagination } = req.query as unknown as ApplicationListQueryDto;
    const { data, total } = await sellersService.listApplications({ status }, pagination);
    sendSuccess(res, data, 'Applications retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getApplication(req: Request, res: Response): Promise<void> {
    const application = await sellersService.getApplicationDetail(req.params.id);
    sendSuccess(res, application);
  },

  async approveApplication(req: Request, res: Response): Promise<void> {
    const result = await sellersService.approveApplication(req.params.id, req.user!.id);
    sendSuccess(res, result, 'Seller application approved');
  },

  async rejectApplication(req: Request, res: Response): Promise<void> {
    const dto = req.body as RejectApplicationDto;
    const application = await sellersService.rejectApplication(req.params.id, dto.reason, req.user!.id);
    sendSuccess(res, application, 'Seller application rejected');
  },

  async requestMoreInfo(req: Request, res: Response): Promise<void> {
    const dto = req.body as RequestMoreInfoDto;
    const application = await sellersService.requestMoreInfo(req.params.id, dto.message, req.user!.id);
    sendSuccess(res, application, 'More information requested');
  },

  async addNote(req: Request, res: Response): Promise<void> {
    const dto = req.body as AddNoteDto;
    const application = await sellersService.addInternalNote(req.params.id, dto.note);
    sendSuccess(res, application, 'Note added');
  },

  async listSellers(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as { page: number; limit: number };
    const { data, total } = await sellersService.listSellers(pagination);
    sendSuccess(res, data, 'Sellers retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getSeller(req: Request, res: Response): Promise<void> {
    const seller = await sellersService.getSellerDetailForAdmin(req.params.id);
    sendSuccess(res, seller);
  },

  async getMyProfile(req: Request, res: Response): Promise<void> {
    const profile = await sellersService.getMyProfile(req.user!.id);
    sendSuccess(res, profile);
  },

  async updateMyProfile(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateSellerProfileDto;
    const profile = await sellersService.updateMyProfile(req.user!.id, dto);
    sendSuccess(res, profile, 'Profile updated');
  },
};
