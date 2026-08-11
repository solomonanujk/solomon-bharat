import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { sellersService } from '../sellers/sellers.service';
import { payoutsService } from './payouts.service';
import { AddNotesDto, AdminPayoutListQueryDto, MarkPaidDto, PayoutListQueryDto } from './payouts.validation';

async function resolveSellerProfileId(userId: string): Promise<string> {
  const profile = await sellersService.getMyProfile(userId);
  return profile.id;
}

export const payoutsController = {
  async listMine(req: Request, res: Response): Promise<void> {
    const sellerId = await resolveSellerProfileId(req.user!.id);
    const { status, ...pagination } = req.query as unknown as PayoutListQueryDto;
    const { data, total } = await payoutsService.listForSeller(sellerId, { status }, pagination);
    sendSuccess(res, data, 'Payouts retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getMySummary(req: Request, res: Response): Promise<void> {
    const sellerId = await resolveSellerProfileId(req.user!.id);
    const summary = await payoutsService.getSellerSummary(sellerId);
    sendSuccess(res, summary);
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { status, sellerId, ...pagination } = req.query as unknown as AdminPayoutListQueryDto;
    const { data, total } = await payoutsService.listForAdmin({ status, sellerId }, pagination);
    sendSuccess(res, data, 'Payouts retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getAdmin(req: Request, res: Response): Promise<void> {
    const payout = await payoutsService.getForAdmin(req.params.id);
    sendSuccess(res, payout);
  },

  async markPaid(req: Request, res: Response): Promise<void> {
    const dto = req.body as MarkPaidDto;
    const payout = await payoutsService.markAsPaid(req.params.id, dto.notes, req.user!.id);
    sendSuccess(res, payout, 'Payout marked as paid');
  },

  async addNotes(req: Request, res: Response): Promise<void> {
    const dto = req.body as AddNotesDto;
    const payout = await payoutsService.addNotes(req.params.id, dto.notes);
    sendSuccess(res, payout, 'Notes updated');
  },
};
