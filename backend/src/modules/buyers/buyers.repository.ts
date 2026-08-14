import {
  Address,
  BuyerProfile,
  Message,
  MessageSender,
  PrismaClient,
  User,
  WishlistItem,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationQuery, toSkipTake } from '../../utils/pagination';
import { CreateAddressInput, UpdateAddressInput, UpdateBuyerProfileInput } from './buyers.types';

const WISHLIST_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  adminPrice: true,
  moq: true,
  leadTime: true,
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
};

export class BuyersRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findProfileByUserId(userId: string): Promise<BuyerProfile | null> {
    return this.db.buyerProfile.findUnique({ where: { userId } });
  }

  findProfileById(id: string): Promise<BuyerProfile | null> {
    return this.db.buyerProfile.findUnique({ where: { id } });
  }

  updateProfile(id: string, input: UpdateBuyerProfileInput): Promise<BuyerProfile> {
    return this.db.buyerProfile.update({ where: { id }, data: input });
  }

  // ── Addresses ──────────────────────────────────────────────────────

  findAddresses(buyerId: string): Promise<Address[]> {
    return this.db.address.findMany({ where: { buyerId }, orderBy: { createdAt: 'desc' } });
  }

  findAddressById(id: string): Promise<Address | null> {
    return this.db.address.findUnique({ where: { id } });
  }

  createAddress(buyerId: string, input: CreateAddressInput): Promise<Address> {
    return this.db.address.create({ data: { buyerId, ...input } });
  }

  updateAddress(id: string, input: UpdateAddressInput): Promise<Address> {
    return this.db.address.update({ where: { id }, data: input });
  }

  deleteAddress(id: string): Promise<Address> {
    return this.db.address.delete({ where: { id } });
  }

  async unsetDefaultAddresses(buyerId: string): Promise<void> {
    await this.db.address.updateMany({ where: { buyerId, isDefault: true }, data: { isDefault: false } });
  }

  // ── Wishlist ───────────────────────────────────────────────────────

  findWishlist(buyerId: string) {
    return this.db.wishlistItem.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: WISHLIST_PRODUCT_SELECT } },
    });
  }

  async wishlistItemExists(buyerId: string, productId: string): Promise<boolean> {
    const count = await this.db.wishlistItem.count({ where: { buyerId, productId } });
    return count > 0;
  }

  addWishlistItem(buyerId: string, productId: string): Promise<WishlistItem> {
    return this.db.wishlistItem.create({ data: { buyerId, productId } });
  }

  async removeWishlistItem(buyerId: string, productId: string): Promise<void> {
    await this.db.wishlistItem.deleteMany({ where: { buyerId, productId } });
  }

  // ── Messages ───────────────────────────────────────────────────────

  findMessages(buyerId: string): Promise<Message[]> {
    return this.db.message.findMany({ where: { buyerId }, orderBy: { createdAt: 'asc' } });
  }

  createMessage(buyerId: string, sender: MessageSender, body: string): Promise<Message> {
    return this.db.message.create({ data: { buyerId, sender, body } });
  }

  async markMessagesRead(buyerId: string, fromSender: MessageSender): Promise<void> {
    await this.db.message.updateMany({
      where: { buyerId, sender: fromSender, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────

  async findBuyers(
    pagination: PaginationQuery,
  ): Promise<{ data: (BuyerProfile & { user: User })[]; total: number }> {
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.db.buyerProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.db.buyerProfile.count({ where }),
    ]);
    return { data, total };
  }

  findBuyerWithUserById(id: string): Promise<(BuyerProfile & { user: User }) | null> {
    return this.db.buyerProfile.findUnique({ where: { id }, include: { user: true } });
  }
}

export const buyersRepository = new BuyersRepository();
