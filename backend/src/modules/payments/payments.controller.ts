import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buyersService } from '../buyers/buyers.service';
import { paymentsService } from './payments.service';
import { CheckoutDto } from './payments.validation';

async function resolveBuyerProfileId(userId: string): Promise<string> {
  const profile = await buyersService.getMyProfile(userId);
  return profile.id;
}

export const paymentsController = {
  async checkout(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as CheckoutDto;
    const result = await paymentsService.checkout(buyerId, dto);
    sendCreated(res, result, 'Checkout created — approve payment to complete your order');
  },

  async capture(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const result = await paymentsService.capture(buyerId, req.params.id);
    sendSuccess(res, result, result.status === 'COMPLETED' ? 'Payment captured' : 'Payment failed');
  },

  async getStatus(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const payment = await paymentsService.getPaymentStatus(buyerId, req.params.id);
    sendSuccess(res, payment);
  },

  async getInvoice(req: Request, res: Response): Promise<void> {
    const requesterId =
      req.user!.role === Role.SUPER_ADMIN ? req.user!.id : await resolveBuyerProfileId(req.user!.id);
    const invoice = await paymentsService.getInvoice(requesterId, req.user!.role, req.params.orderId);
    sendSuccess(res, invoice);
  },
};
