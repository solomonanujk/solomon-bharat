import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta, paginationQuerySchema, PaginationQuery } from '../../utils/pagination';
import { collectionsService } from './collections.service';
import {
  AddProductDto,
  AdminCollectionListQueryDto,
  CreateCollectionDto,
  ReorderMembershipDto,
  UpdateCollectionDto,
} from './collections.validation';

export const collectionsController = {
  async create(req: Request, res: Response): Promise<void> {
    const dto = req.body as CreateCollectionDto;
    const collection = await collectionsService.createCollection(dto);
    sendCreated(res, collection, 'Collection created');
  },

  async update(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateCollectionDto;
    const collection = await collectionsService.updateCollection(req.params.id, dto);
    sendSuccess(res, collection, 'Collection updated');
  },

  async publish(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.publishCollection(req.params.id);
    sendSuccess(res, collection, 'Collection published');
  },

  async unpublish(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.unpublishToDraft(req.params.id);
    sendSuccess(res, collection, 'Collection moved back to draft');
  },

  async archive(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.archiveCollection(req.params.id);
    sendSuccess(res, collection, 'Collection archived');
  },

  async feature(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.setFeatured(req.params.id, true);
    sendSuccess(res, collection, 'Collection featured');
  },

  async unfeature(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.setFeatured(req.params.id, false);
    sendSuccess(res, collection, 'Collection unfeatured');
  },

  async addProduct(req: Request, res: Response): Promise<void> {
    const dto = req.body as AddProductDto;
    await collectionsService.addProduct(req.params.id, dto, req.user!.id);
    sendSuccess(res, null, 'Product added to collection');
  },

  async removeProduct(req: Request, res: Response): Promise<void> {
    await collectionsService.removeProduct(req.params.id, req.params.productId, req.user!.id);
    sendSuccess(res, null, 'Product removed from collection');
  },

  async reorderMembership(req: Request, res: Response): Promise<void> {
    const dto = req.body as ReorderMembershipDto;
    await collectionsService.reorderMembership(req.params.id, dto);
    sendSuccess(res, null, 'Collection products reordered');
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { status, ...pagination } = req.query as unknown as AdminCollectionListQueryDto;
    const { data, total } = await collectionsService.listAdmin({ status }, pagination);
    sendSuccess(res, data, 'Collections retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getAdminDetail(req: Request, res: Response): Promise<void> {
    const collection = await collectionsService.getAdminDetail(req.params.id);
    sendSuccess(res, collection);
  },

  async listPublic(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await collectionsService.listPublic(pagination);
    sendSuccess(res, data, 'Collections retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async listFeatured(_req: Request, res: Response): Promise<void> {
    const data = await collectionsService.listFeatured();
    sendSuccess(res, data);
  },

  async getPublicDetail(req: Request, res: Response): Promise<void> {
    const pagination = paginationQuerySchema.parse(req.query);
    const result = await collectionsService.getPublicDetail(req.params.slug, pagination);
    sendSuccess(res, result);
  },
};
