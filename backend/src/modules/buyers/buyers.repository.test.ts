import { describe, it, expect, beforeEach } from 'vitest';
import { MessageSender } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { BuyersRepository } from './buyers.repository';

describe('BuyersRepository', () => {
  let db: MockPrismaClient;
  let repo: BuyersRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      buyerProfile: mockModel(),
      address: mockModel(),
      wishlistItem: mockModel(),
      message: mockModel(),
    });
    repo = new BuyersRepository(db as never);
  });

  it('findProfileByUserId queries by userId', async () => {
    db.buyerProfile.findUnique.mockResolvedValue({ id: 'bp1' });
    await repo.findProfileByUserId('u1');
    expect(db.buyerProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('updateProfile passes input as data', async () => {
    db.buyerProfile.update.mockResolvedValue({ id: 'bp1' });
    await repo.updateProfile('bp1', { companyName: 'Acme' });
    expect(db.buyerProfile.update).toHaveBeenCalledWith({ where: { id: 'bp1' }, data: { companyName: 'Acme' } });
  });

  it('findAddresses scopes to the buyer, newest first', async () => {
    db.address.findMany.mockResolvedValue([]);
    await repo.findAddresses('bp1');
    expect(db.address.findMany).toHaveBeenCalledWith({ where: { buyerId: 'bp1' }, orderBy: { createdAt: 'desc' } });
  });

  it('createAddress merges buyerId into the input', async () => {
    db.address.create.mockResolvedValue({ id: 'addr1' });
    await repo.createAddress('bp1', { line1: '221B Baker St', city: 'Mumbai', postalCode: '400001', country: 'IN' });
    expect(db.address.create).toHaveBeenCalledWith({
      data: { buyerId: 'bp1', line1: '221B Baker St', city: 'Mumbai', postalCode: '400001', country: 'IN' },
    });
  });

  it('deleteAddress deletes by id', async () => {
    db.address.delete.mockResolvedValue({ id: 'addr1' });
    await repo.deleteAddress('addr1');
    expect(db.address.delete).toHaveBeenCalledWith({ where: { id: 'addr1' } });
  });

  it('unsetDefaultAddresses clears isDefault for all of the buyer\'s addresses', async () => {
    db.address.updateMany.mockResolvedValue({ count: 1 });
    await repo.unsetDefaultAddresses('bp1');
    expect(db.address.updateMany).toHaveBeenCalledWith({
      where: { buyerId: 'bp1', isDefault: true },
      data: { isDefault: false },
    });
  });

  it('findWishlist includes a single sorted product image', async () => {
    db.wishlistItem.findMany.mockResolvedValue([]);
    await repo.findWishlist('bp1');
    const arg = db.wishlistItem.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ buyerId: 'bp1' });
    expect(arg.include.product.select.images).toEqual({ orderBy: { sortOrder: 'asc' }, take: 1 });
  });

  it('wishlistItemExists reflects presence', async () => {
    db.wishlistItem.count.mockResolvedValue(1);
    await expect(repo.wishlistItemExists('bp1', 'p1')).resolves.toBe(true);
  });

  it('addWishlistItem creates a membership row', async () => {
    db.wishlistItem.create.mockResolvedValue({ id: 'wi1' });
    await repo.addWishlistItem('bp1', 'p1');
    expect(db.wishlistItem.create).toHaveBeenCalledWith({ data: { buyerId: 'bp1', productId: 'p1' } });
  });

  it('removeWishlistItem deletes matching rows', async () => {
    db.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });
    await repo.removeWishlistItem('bp1', 'p1');
    expect(db.wishlistItem.deleteMany).toHaveBeenCalledWith({ where: { buyerId: 'bp1', productId: 'p1' } });
  });

  it('findMessages orders oldest first for a natural conversation flow', async () => {
    db.message.findMany.mockResolvedValue([]);
    await repo.findMessages('bp1');
    expect(db.message.findMany).toHaveBeenCalledWith({ where: { buyerId: 'bp1' }, orderBy: { createdAt: 'asc' } });
  });

  it('createMessage records the sender and body', async () => {
    db.message.create.mockResolvedValue({ id: 'm1' });
    await repo.createMessage('bp1', MessageSender.BUYER, 'Hello');
    expect(db.message.create).toHaveBeenCalledWith({
      data: { buyerId: 'bp1', sender: MessageSender.BUYER, body: 'Hello' },
    });
  });

  it('markMessagesRead only touches unread messages from the given sender', async () => {
    db.message.updateMany.mockResolvedValue({ count: 2 });
    await repo.markMessagesRead('bp1', MessageSender.ADMIN);
    expect(db.message.updateMany).toHaveBeenCalledWith({
      where: { buyerId: 'bp1', sender: MessageSender.ADMIN, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('findBuyers scopes to non-deleted profiles and includes the user', async () => {
    db.buyerProfile.findMany.mockResolvedValue([]);
    db.buyerProfile.count.mockResolvedValue(0);
    await repo.findBuyers({ page: 1, limit: 20 });
    const arg = db.buyerProfile.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: null });
  });
});
