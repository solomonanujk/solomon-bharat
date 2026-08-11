import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta, PaginationQuery } from '../../utils/pagination';
import { buyersService } from './buyers.service';
import {
  AddWishlistItemDto,
  CreateAddressDto,
  SendMessageDto,
  UpdateAddressDto,
  UpdateBuyerProfileDto,
} from './buyers.validation';

async function resolveBuyerProfileId(userId: string): Promise<string> {
  const profile = await buyersService.getMyProfile(userId);
  return profile.id;
}

export const buyersController = {
  async getMyProfile(req: Request, res: Response): Promise<void> {
    const profile = await buyersService.getMyProfile(req.user!.id);
    sendSuccess(res, profile);
  },

  async updateMyProfile(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateBuyerProfileDto;
    const profile = await buyersService.updateMyProfile(req.user!.id, dto);
    sendSuccess(res, profile, 'Profile updated');
  },

  async listAddresses(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const addresses = await buyersService.listAddresses(buyerId);
    sendSuccess(res, addresses);
  },

  async createAddress(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as CreateAddressDto;
    const address = await buyersService.createAddress(buyerId, dto);
    sendCreated(res, address, 'Address added');
  },

  async updateAddress(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as UpdateAddressDto;
    const address = await buyersService.updateAddress(buyerId, req.params.id, dto);
    sendSuccess(res, address, 'Address updated');
  },

  async deleteAddress(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    await buyersService.deleteAddress(buyerId, req.params.id);
    sendSuccess(res, null, 'Address deleted');
  },

  async setDefaultAddress(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const address = await buyersService.setDefaultAddress(buyerId, req.params.id);
    sendSuccess(res, address, 'Default address updated');
  },

  async listWishlist(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const items = await buyersService.listWishlist(buyerId);
    sendSuccess(res, items);
  },

  async addToWishlist(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as AddWishlistItemDto;
    await buyersService.addToWishlist(buyerId, dto.productId);
    sendSuccess(res, null, 'Added to wishlist');
  },

  async removeFromWishlist(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    await buyersService.removeFromWishlist(buyerId, req.params.productId);
    sendSuccess(res, null, 'Removed from wishlist');
  },

  async getMyMessages(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const messages = await buyersService.getMyConversation(buyerId);
    sendSuccess(res, messages);
  },

  async sendMyMessage(req: Request, res: Response): Promise<void> {
    const buyerId = await resolveBuyerProfileId(req.user!.id);
    const dto = req.body as SendMessageDto;
    const message = await buyersService.sendMessageAsBuyer(buyerId, dto.body);
    sendCreated(res, message, 'Message sent');
  },

  async listBuyersAdmin(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as PaginationQuery;
    const { data, total } = await buyersService.listBuyersForAdmin(pagination);
    sendSuccess(res, data, 'Buyers retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getBuyerAdmin(req: Request, res: Response): Promise<void> {
    const buyer = await buyersService.getBuyerForAdmin(req.params.id);
    sendSuccess(res, buyer);
  },

  async getConversationAdmin(req: Request, res: Response): Promise<void> {
    const messages = await buyersService.getConversationForAdmin(req.params.id);
    sendSuccess(res, messages);
  },

  async sendMessageAdmin(req: Request, res: Response): Promise<void> {
    const dto = req.body as SendMessageDto;
    const message = await buyersService.sendMessageAsAdmin(req.params.id, dto.body);
    sendCreated(res, message, 'Message sent');
  },
};
