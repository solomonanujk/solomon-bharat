import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { sellersService } from '../sellers/sellers.service';
import { buyersService } from '../buyers/buyers.service';
import { ordersService } from './orders.service';
import {
  AdminOrderListQueryDto,
  CancelOrderDto,
  ExportDocumentsDto,
  ProcureDto,
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

export const ordersController = {
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
