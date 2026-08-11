import { Address, BuyerProfile, MessageSender } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { toSafeUser } from '../../utils/safeUser';
import { PaginationQuery } from '../../utils/pagination';
import { prisma } from '../../config/prisma';
import { notificationsService } from '../notifications/notifications.service';
import { BuyersRepository, buyersRepository } from './buyers.repository';
import {
  CreateAddressInput,
  UpdateAddressInput,
  UpdateBuyerProfileInput,
  WishlistEntry,
} from './buyers.types';

export class BuyersService {
  constructor(private readonly repo: BuyersRepository = buyersRepository) {}

  async getMyProfile(userId: string): Promise<BuyerProfile> {
    const profile = await this.repo.findProfileByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Buyer profile not found');
    }
    return profile;
  }

  async updateMyProfile(userId: string, input: UpdateBuyerProfileInput): Promise<BuyerProfile> {
    const profile = await this.getMyProfile(userId);
    return this.repo.updateProfile(profile.id, input);
  }

  // ── Addresses ──────────────────────────────────────────────────────

  async listAddresses(buyerId: string): Promise<Address[]> {
    return this.repo.findAddresses(buyerId);
  }

  private async getOwnedAddressOrThrow(buyerId: string, addressId: string): Promise<Address> {
    const address = await this.repo.findAddressById(addressId);
    if (!address || address.buyerId !== buyerId) {
      throw AppError.notFound('Address not found');
    }
    return address;
  }

  /** Used by the orders module to validate a checkout's shippingAddressId belongs to the buyer. */
  async verifyAddressOwnership(buyerId: string, addressId: string): Promise<Address> {
    return this.getOwnedAddressOrThrow(buyerId, addressId);
  }

  async createAddress(buyerId: string, input: CreateAddressInput): Promise<Address> {
    if (input.isDefault) {
      await this.repo.unsetDefaultAddresses(buyerId);
    }
    return this.repo.createAddress(buyerId, input);
  }

  async updateAddress(buyerId: string, addressId: string, input: UpdateAddressInput): Promise<Address> {
    await this.getOwnedAddressOrThrow(buyerId, addressId);
    if (input.isDefault) {
      await this.repo.unsetDefaultAddresses(buyerId);
    }
    return this.repo.updateAddress(addressId, input);
  }

  async deleteAddress(buyerId: string, addressId: string): Promise<void> {
    await this.getOwnedAddressOrThrow(buyerId, addressId);
    await this.repo.deleteAddress(addressId);
  }

  async setDefaultAddress(buyerId: string, addressId: string): Promise<Address> {
    await this.getOwnedAddressOrThrow(buyerId, addressId);
    await this.repo.unsetDefaultAddresses(buyerId);
    return this.repo.updateAddress(addressId, { isDefault: true });
  }

  // ── Wishlist ───────────────────────────────────────────────────────

  async listWishlist(buyerId: string): Promise<WishlistEntry[]> {
    const items = await this.repo.findWishlist(buyerId);
    return items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        adminPrice: item.product.adminPrice ? item.product.adminPrice.toString() : '0',
        moq: item.product.moq,
        imageUrl: item.product.images[0]?.url ?? null,
      },
    }));
  }

  async addToWishlist(buyerId: string, productId: string): Promise<void> {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt || !product.isPublished) {
      throw AppError.notFound('Product not found');
    }

    const exists = await this.repo.wishlistItemExists(buyerId, productId);
    if (exists) return;

    await this.repo.addWishlistItem(buyerId, productId);
  }

  async removeFromWishlist(buyerId: string, productId: string): Promise<void> {
    await this.repo.removeWishlistItem(buyerId, productId);
  }

  // ── Messages ───────────────────────────────────────────────────────

  async getMyConversation(buyerId: string) {
    const messages = await this.repo.findMessages(buyerId);
    await this.repo.markMessagesRead(buyerId, MessageSender.ADMIN);
    return messages;
  }

  async sendMessageAsBuyer(buyerId: string, body: string) {
    const message = await this.repo.createMessage(buyerId, MessageSender.BUYER, body);
    await notificationsService.notifyNewMessageToAdmins();
    return message;
  }

  async getConversationForAdmin(buyerId: string) {
    await this.getBuyerOrThrow(buyerId);
    const messages = await this.repo.findMessages(buyerId);
    await this.repo.markMessagesRead(buyerId, MessageSender.BUYER);
    return messages;
  }

  async sendMessageAsAdmin(buyerId: string, body: string) {
    const buyer = await this.getBuyerOrThrow(buyerId);
    const message = await this.repo.createMessage(buyerId, MessageSender.ADMIN, body);
    await notificationsService.notifyNewMessageToBuyer(buyer.userId);
    return message;
  }

  // ── Admin ──────────────────────────────────────────────────────────

  private async getBuyerOrThrow(id: string): Promise<BuyerProfile> {
    const profile = await this.repo.findProfileById(id);
    if (!profile) {
      throw AppError.notFound('Buyer not found');
    }
    return profile;
  }

  async listBuyersForAdmin(pagination: PaginationQuery) {
    const { data, total } = await this.repo.findBuyers(pagination);
    return { data: data.map(({ user, ...profile }) => ({ ...profile, user: toSafeUser(user) })), total };
  }

  async getBuyerForAdmin(id: string) {
    const buyer = await this.repo.findBuyerWithUserById(id);
    if (!buyer) {
      throw AppError.notFound('Buyer not found');
    }
    const { user, ...profile } = buyer;
    return { ...profile, user: toSafeUser(user) };
  }
}

export const buyersService = new BuyersService();
