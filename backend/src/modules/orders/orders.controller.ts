import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { sellersService } from '../sellers/sellers.service';
import { buyersService } from '../buyers/buyers.service';
import { storageProvider } from '../../providers/storage';
import { ordersService } from './orders.service';
import { exportDocumentsService } from './documents/exportDocuments.service';
import { ExportDocumentType } from './documents/exportDocuments';
import {
  AdminOrderListQueryDto,
  BuyerCancelDto,
  RefundDto,
  CancelOrderDto,
  ExportDocumentsDto,
  ProcureDto,
  QuoteDto,
  ShipDto,
  TrackingDto,
} from './orders.validation';

async function resolveSellerProfileId(userId: string): Promise<string> {
  const profile = await sellersService.getMyProfile(userId);
  return profile.id;
}

async function resolveBuyerProfileId(userId: string): Promise<string> {
  const profile = await buyersService.getMyProfile(userId);
  return profile.id;
}

/** Uploads the multipart `photos` of a dispatch request and returns their URLs. */
async function uploadDispatchPhotos(req: Request, orderId: string): Promise<string[]> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const uploads = await Promise.all(
    files.map((f, i) => storageProvider.uploadImage(f.buffer, `${Date.now()}-${i}-${f.originalname}`, `dispatch/${orderId}`)),
  );
  return uploads.map((u) => u.url);
}

function sendPdf(res: Response, { filename, pdf }: { filename: string; pdf: Buffer }): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
}

export const ordersController = {
  async adminDocument(req: Request, res: Response): Promise<void> {
    sendPdf(res, await exportDocumentsService.build(req.params.id, req.params.type as ExportDocumentType));
  },

  async buyerCancel(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as BuyerCancelDto;
    sendSuccess(res, await ordersService.buyerCancel(buyerId, req.params.id, dto.reason), 'Order cancelled');
  },

  async qualityCheck(req: Request, res: Response): Promise<void> {
    const photos = await uploadDispatchPhotos(req, req.params.id);
    sendSuccess(res, await ordersService.qualityCheckOrder(req.params.id, req.user!.id, photos), 'Order quality-checked');
  },

  async refund(req: Request, res: Response): Promise<void> {
    const dto = req.body as RefundDto;
    sendSuccess(res, await ordersService.markRefunded(req.params.id, req.user!.id, dto.reference), 'Order marked refunded');
  },

  async quote(req: Request, res: Response): Promise<void> {
    const dto = req.body as QuoteDto;
    const pricingRole = req.user!.role === Role.AGENT ? 'AGENT' : 'BUYER';
    sendSuccess(res, await ordersService.quoteItems(dto.items, pricingRole), 'Quote calculated');
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await ordersService.listMyOrders(buyerId, pagination);
    sendSuccess(res, data, 'Orders retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getMine(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const order = await ordersService.getMyOrder(buyerId, req.params.id);
    sendSuccess(res, order);
  },

  async listSellerItems(req: Request, res: Response): Promise<void> {
    const sellerProfileId = await resolveSellerProfileId(req.user!.id);
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await ordersService.listItemsForSeller(sellerProfileId, pagination);
    sendSuccess(res, data, 'Order items retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { status, buyerId, ...pagination } = req.query as unknown as AdminOrderListQueryDto;
    const { data, total } = await ordersService.listForAdmin({ status, buyerId }, pagination);
    sendSuccess(res, data, 'Orders retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getAdmin(req: Request, res: Response): Promise<void> {
    const order = await ordersService.getForAdmin(req.params.id);
    sendSuccess(res, order);
  },

  async confirm(req: Request, res: Response): Promise<void> {
    const order = await ordersService.confirmOrder(req.params.id, req.user!.id);
    sendSuccess(res, order, 'Order confirmed');
  },

  async procure(req: Request, res: Response): Promise<void> {
    const dto = req.body as ProcureDto;
    const order = await ordersService.procureOrder(req.params.id, req.user!.id, dto.expectedCollectionDate);
    sendSuccess(res, order, 'Order moved to procuring');
  },

  async collect(req: Request, res: Response): Promise<void> {
    const order = await ordersService.collectOrder(req.params.id, req.user!.id);
    sendSuccess(res, order, 'Order marked as collected');
  },

  async ship(req: Request, res: Response): Promise<void> {
    const dto = req.body as ShipDto;
    const order = await ordersService.shipOrder(req.params.id, req.user!.id, dto.trackingNumber);
    sendSuccess(res, order, 'Order marked as in transit');
  },

  async deliver(req: Request, res: Response): Promise<void> {
    const order = await ordersService.deliverOrder(req.params.id, req.user!.id);
    sendSuccess(res, order, 'Order marked as delivered');
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const dto = req.body as CancelOrderDto;
    const order = await ordersService.cancelOrder(req.params.id, dto.reason, req.user!.id);
    sendSuccess(res, order, 'Order cancelled');
  },

  async setTracking(req: Request, res: Response): Promise<void> {
    const dto = req.body as TrackingDto;
    const order = await ordersService.setTrackingNumber(req.params.id, dto.trackingNumber);
    sendSuccess(res, order, 'Tracking number updated');
  },

  async setExportDocuments(req: Request, res: Response): Promise<void> {
    const dto = req.body as ExportDocumentsDto;
    const order = await ordersService.setExportDocuments(req.params.id, dto.documents);
    sendSuccess(res, order, 'Export documents attached');
  },
};
