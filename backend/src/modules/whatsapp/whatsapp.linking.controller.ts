import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { whatsAppLinkingService } from './whatsapp.linking.service';

export const whatsAppLinkingController = {
  async status(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await whatsAppLinkingService.getStatus(req.user!.id));
  },

  async requestCode(req: Request, res: Response): Promise<void> {
    const result = await whatsAppLinkingService.requestCode(req.user!.id, req.body.phone);
    sendSuccess(res, result, 'Verification code sent on WhatsApp');
  },

  async verify(req: Request, res: Response): Promise<void> {
    const status = await whatsAppLinkingService.verifyCode(req.user!.id, req.body.code);
    sendSuccess(res, status, 'WhatsApp number linked');
  },

  async unlink(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await whatsAppLinkingService.unlink(req.user!.id), 'WhatsApp number unlinked');
  },
};
