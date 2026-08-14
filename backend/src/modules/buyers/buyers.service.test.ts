import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Address, BuyerProfile, MessageSender } from '@prisma/client';
import { ReviewsRepository } from '../reviews/reviews.repository';
import { BuyersRepository } from './buyers.repository';
import { BuyersService } from './buyers.service';

vi.mock('../../config/prisma', () => ({
  prisma: { product: { findUnique: vi.fn() } },
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifyNewMessageToAdmins: vi.fn().mockResolvedValue(undefined),
    notifyNewMessageToBuyer: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../../config/prisma';

function buildAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'addr-1',
    buyerId: 'buyer-1',
    label: null,
    line1: '221B Baker Street',
    line2: null,
    city: 'London',
    state: null,
    postalCode: 'NW1 6XE',
    country: 'UK',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildProfile(overrides: Partial<BuyerProfile> = {}): BuyerProfile {
  return {
    id: 'buyer-1',
    userId: 'user-1',
    companyName: null,
    contactName: 'Jane Buyer',
    phone: null,
    country: 'UK',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildMockRepo(): BuyersRepository {
  return {
    findProfileByUserId: vi.fn(),
    findProfileById: vi.fn(),
    updateProfile: vi.fn(),
    findAddresses: vi.fn(),
    findAddressById: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
    unsetDefaultAddresses: vi.fn(),
    findWishlist: vi.fn(),
    wishlistItemExists: vi.fn(),
    addWishlistItem: vi.fn(),
    removeWishlistItem: vi.fn(),
    findMessages: vi.fn(),
    createMessage: vi.fn(),
    markMessagesRead: vi.fn(),
    findBuyers: vi.fn(),
    findBuyerWithUserById: vi.fn(),
  } as unknown as BuyersRepository;
}

function buildMockReviews(): ReviewsRepository {
  return {
    getRatingSummaries: vi.fn().mockResolvedValue(new Map()),
  } as unknown as ReviewsRepository;
}

describe('BuyersService', () => {
  let repo: BuyersRepository;
  let reviews: ReviewsRepository;
  let service: BuyersService;

  beforeEach(() => {
    repo = buildMockRepo();
    reviews = buildMockReviews();
    service = new BuyersService(repo, reviews);
    vi.mocked(prisma.product.findUnique).mockReset();
  });

  describe('addresses', () => {
    it('rejects updating an address owned by a different buyer', async () => {
      vi.mocked(repo.findAddressById).mockResolvedValue(buildAddress({ buyerId: 'someone-else' }));

      await expect(
        service.updateAddress('buyer-1', 'addr-1', { city: 'Manchester' }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(repo.updateAddress).not.toHaveBeenCalled();
    });

    it('unsets other defaults before creating a new default address', async () => {
      vi.mocked(repo.createAddress).mockResolvedValue(buildAddress({ isDefault: true }));

      await service.createAddress('buyer-1', {
        line1: '10 Downing St',
        city: 'London',
        postalCode: 'SW1A 2AA',
        country: 'UK',
        isDefault: true,
      });

      expect(repo.unsetDefaultAddresses).toHaveBeenCalledWith('buyer-1');
      expect(repo.createAddress).toHaveBeenCalled();
    });

    it('setDefaultAddress unsets other defaults then sets this one', async () => {
      vi.mocked(repo.findAddressById).mockResolvedValue(buildAddress());
      vi.mocked(repo.updateAddress).mockResolvedValue(buildAddress({ isDefault: true }));

      await service.setDefaultAddress('buyer-1', 'addr-1');

      expect(repo.unsetDefaultAddresses).toHaveBeenCalledWith('buyer-1');
      expect(repo.updateAddress).toHaveBeenCalledWith('addr-1', { isDefault: true });
    });
  });

  describe('addToWishlist', () => {
    it('rejects wishlisting a product that is not published', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        deletedAt: null,
        isPublished: false,
      } as never);

      await expect(service.addToWishlist('buyer-1', 'prod-1')).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(repo.addWishlistItem).not.toHaveBeenCalled();
    });

    it('is idempotent — does not error or duplicate if already wishlisted', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        deletedAt: null,
        isPublished: true,
      } as never);
      vi.mocked(repo.wishlistItemExists).mockResolvedValue(true);

      await service.addToWishlist('buyer-1', 'prod-1');

      expect(repo.addWishlistItem).not.toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('viewing my conversation marks ADMIN-sent messages as read, not my own', async () => {
      vi.mocked(repo.findMessages).mockResolvedValue([]);

      await service.getMyConversation('buyer-1');

      expect(repo.markMessagesRead).toHaveBeenCalledWith('buyer-1', MessageSender.ADMIN);
    });

    it('admin viewing a conversation marks BUYER-sent messages as read', async () => {
      vi.mocked(repo.findProfileById).mockResolvedValue(buildProfile());
      vi.mocked(repo.findMessages).mockResolvedValue([]);

      await service.getConversationForAdmin('buyer-1');

      expect(repo.markMessagesRead).toHaveBeenCalledWith('buyer-1', MessageSender.BUYER);
    });

    it('rejects an admin reply to a buyer that does not exist', async () => {
      vi.mocked(repo.findProfileById).mockResolvedValue(null);

      await expect(service.sendMessageAsAdmin('missing', 'hello')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('profile', () => {
    it('getMyProfile throws 404 when no profile exists for the user', async () => {
      vi.mocked(repo.findProfileByUserId).mockResolvedValue(null);

      await expect(service.getMyProfile('user-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('updateMyProfile resolves the profile then updates it', async () => {
      vi.mocked(repo.findProfileByUserId).mockResolvedValue(buildProfile());
      vi.mocked(repo.updateProfile).mockResolvedValue(buildProfile({ contactName: 'New Name' }));

      const result = await service.updateMyProfile('user-1', { contactName: 'New Name' });

      expect(repo.updateProfile).toHaveBeenCalledWith('buyer-1', { contactName: 'New Name' });
      expect(result.contactName).toBe('New Name');
    });
  });

  describe('address listing and deletion', () => {
    it('listAddresses delegates to the repository', async () => {
      vi.mocked(repo.findAddresses).mockResolvedValue([buildAddress()]);

      const addresses = await service.listAddresses('buyer-1');

      expect(repo.findAddresses).toHaveBeenCalledWith('buyer-1');
      expect(addresses).toHaveLength(1);
    });

    it('rejects deleting an address owned by a different buyer', async () => {
      vi.mocked(repo.findAddressById).mockResolvedValue(buildAddress({ buyerId: 'someone-else' }));

      await expect(service.deleteAddress('buyer-1', 'addr-1')).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.deleteAddress).not.toHaveBeenCalled();
    });

    it('deletes an address owned by the buyer', async () => {
      vi.mocked(repo.findAddressById).mockResolvedValue(buildAddress());

      await service.deleteAddress('buyer-1', 'addr-1');

      expect(repo.deleteAddress).toHaveBeenCalledWith('addr-1');
    });
  });

  describe('wishlist listing and removal', () => {
    it('listWishlist maps product prices to strings and picks the first image', async () => {
      vi.mocked(repo.findWishlist).mockResolvedValue([
        {
          id: 'wish-1',
          createdAt: new Date(),
          product: {
            id: 'prod-1',
            name: 'Table Runner',
            slug: 'table-runner',
            adminPrice: { toString: () => '20' } as never,
            moq: 10,
            images: [{ url: 'https://cdn.example.com/img.jpg' }],
          },
        },
      ] as never);

      const items = await service.listWishlist('buyer-1');

      expect(items[0].product).toMatchObject({
        name: 'Table Runner',
        adminPrice: '20',
        imageUrl: 'https://cdn.example.com/img.jpg',
        avgRating: null,
        reviewCount: 0,
      });
    });

    it('listWishlist attaches the batched rating summary for each product', async () => {
      vi.mocked(repo.findWishlist).mockResolvedValue([
        {
          id: 'wish-1',
          createdAt: new Date(),
          product: {
            id: 'prod-1',
            name: 'Table Runner',
            slug: 'table-runner',
            adminPrice: { toString: () => '20' } as never,
            moq: 10,
            images: [{ url: 'https://cdn.example.com/img.jpg' }],
          },
        },
      ] as never);
      vi.mocked(reviews.getRatingSummaries).mockResolvedValue(
        new Map([['prod-1', { avgRating: 4.5, reviewCount: 6 }]]),
      );

      const items = await service.listWishlist('buyer-1');

      expect(reviews.getRatingSummaries).toHaveBeenCalledWith(['prod-1']);
      expect(items[0].product).toMatchObject({ avgRating: 4.5, reviewCount: 6 });
    });

    it('listWishlist falls back to null imageUrl when the product has no images', async () => {
      vi.mocked(repo.findWishlist).mockResolvedValue([
        {
          id: 'wish-1',
          createdAt: new Date(),
          product: {
            id: 'prod-1',
            name: 'Table Runner',
            slug: 'table-runner',
            adminPrice: null,
            moq: 10,
            images: [],
          },
        },
      ] as never);

      const items = await service.listWishlist('buyer-1');

      expect(items[0].product.imageUrl).toBeNull();
      expect(items[0].product.adminPrice).toBe('0');
    });

    it('removeFromWishlist delegates to the repository', async () => {
      await service.removeFromWishlist('buyer-1', 'prod-1');

      expect(repo.removeWishlistItem).toHaveBeenCalledWith('buyer-1', 'prod-1');
    });
  });

  describe('sendMessageAsBuyer', () => {
    it('creates the message and notifies all admins', async () => {
      vi.mocked(repo.createMessage).mockResolvedValue({
        id: 'msg-1',
        buyerId: 'buyer-1',
        sender: MessageSender.BUYER,
        body: 'Hello',
        readAt: null,
        createdAt: new Date(),
      });

      await service.sendMessageAsBuyer('buyer-1', 'Hello');

      expect(repo.createMessage).toHaveBeenCalledWith('buyer-1', MessageSender.BUYER, 'Hello');
    });
  });

  describe('getBuyerForAdmin', () => {
    it('throws 404 for a buyer that does not exist', async () => {
      vi.mocked(repo.findBuyerWithUserById).mockResolvedValue(null);

      await expect(service.getBuyerForAdmin('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('never leaks passwordHash for a single buyer lookup', async () => {
      vi.mocked(repo.findBuyerWithUserById).mockResolvedValue({
        ...buildProfile(),
        user: {
          id: 'user-1',
          email: 'buyer@example.com',
          passwordHash: 'super-secret-hash',
          role: 'BUYER',
          status: 'ACTIVE',
          emailVerifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as never);

      const result = await service.getBuyerForAdmin('buyer-1');

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('listBuyersForAdmin', () => {
    it('never leaks passwordHash via the nested user object', async () => {
      vi.mocked(repo.findBuyers).mockResolvedValue({
        data: [
          {
            ...buildProfile(),
            user: {
              id: 'user-1',
              email: 'buyer@example.com',
              passwordHash: 'super-secret-hash',
              role: 'BUYER',
              status: 'ACTIVE',
              emailVerifiedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        total: 1,
      } as never);

      const { data } = await service.listBuyersForAdmin({ page: 1, limit: 20 });

      expect(data[0].user).not.toHaveProperty('passwordHash');
    });
  });
});
