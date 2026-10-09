import { describe, it, expect, beforeEach } from 'vitest';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { BrandsRepository } from './brands.repository';

describe('BrandsRepository', () => {
  let db: MockPrismaClient;
  let repo: BrandsRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      brand: mockModel(),
      brandFollow: mockModel(),
      buyerProfile: mockModel(),
      order: mockModel(),
      platformSetting: mockModel(),
    });
    repo = new BrandsRepository(db as never);
  });

  it('findActive only returns ACTIVE brands and counts only live products', async () => {
    db.brand.findMany.mockResolvedValue([]);
    db.brand.count.mockResolvedValue(0);

    await repo.findActive('kala', { page: 2, limit: 10 });

    const arg = db.brand.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: 'ACTIVE', name: { contains: 'kala', mode: 'insensitive' } });
    expect(arg.include._count.select.products.where).toEqual({
      approvalStatus: 'APPROVED',
      isPublished: true,
      deletedAt: null,
    });
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(10);
  });

  it('findActiveBySlug excludes suspended brands', async () => {
    db.brand.findFirst.mockResolvedValue(null);
    await repo.findActiveBySlug('x');
    expect(db.brand.findFirst.mock.calls[0][0].where).toEqual({ slug: 'x', status: 'ACTIVE' });
  });

  it('findByUserId resolves through the seller profile', async () => {
    db.brand.findFirst.mockResolvedValue(null);
    await repo.findByUserId('u1');
    expect(db.brand.findFirst.mock.calls[0][0].where).toEqual({ sellerProfile: { userId: 'u1', deletedAt: null } });
  });

  it('followBrand upserts on the (buyerId, brandId) key so repeats are idempotent', async () => {
    await repo.followBrand('b1', 'br1');
    expect(db.brandFollow.upsert).toHaveBeenCalledWith({
      where: { buyerId_brandId: { buyerId: 'b1', brandId: 'br1' } },
      update: {},
      create: { buyerId: 'b1', brandId: 'br1' },
    });
  });

  it('unfollowBrand uses deleteMany (no error when absent)', async () => {
    await repo.unfollowBrand('b1', 'br1');
    expect(db.brandFollow.deleteMany).toHaveBeenCalledWith({ where: { buyerId: 'b1', brandId: 'br1' } });
  });

  it('isFollowing reflects row existence', async () => {
    db.brandFollow.findUnique.mockResolvedValueOnce({ id: 'f' }).mockResolvedValueOnce(null);
    expect(await repo.isFollowing('b', 'br')).toBe(true);
    expect(await repo.isFollowing('b', 'br')).toBe(false);
  });

  it('findBuyerProfileId returns null without a profile', async () => {
    db.buyerProfile.findUnique.mockResolvedValue(null);
    expect(await repo.findBuyerProfileId('u')).toBeNull();
    db.buyerProfile.findUnique.mockResolvedValue({ id: 'bp' });
    expect(await repo.findBuyerProfileId('u')).toBe('bp');
  });

  it('findFollowedBrands only returns active brands', async () => {
    db.brandFollow.findMany.mockResolvedValue([{ brand: { id: 'x' } }]);
    db.brandFollow.count.mockResolvedValue(1);
    const res = await repo.findFollowedBrands('b1', { page: 1, limit: 20 });
    expect(db.brandFollow.findMany.mock.calls[0][0].where).toEqual({ buyerId: 'b1', brand: { status: 'ACTIVE' } });
    expect(res.data).toEqual([{ id: 'x' }]);
  });

  it('findAllForAdmin applies status + search filters', async () => {
    db.brand.findMany.mockResolvedValue([]);
    db.brand.count.mockResolvedValue(0);
    await repo.findAllForAdmin({ status: 'SUSPENDED' as never, search: 'k' }, { page: 1, limit: 20 });
    expect(db.brand.findMany.mock.calls[0][0].where).toEqual({
      status: 'SUSPENDED',
      name: { contains: 'k', mode: 'insensitive' },
    });
  });

  it('getOrderStatsBySellerProfile excludes unpaid and cancelled orders, and short-circuits on empty input', async () => {
    expect((await repo.getOrderStatsBySellerProfile([])).size).toBe(0);
    expect(db.order.groupBy).not.toHaveBeenCalled();

    db.order.groupBy.mockResolvedValue([
      { sellerProfileId: 'sp1', _count: { _all: 2 }, _sum: { adminPriceTotal: '150.50' } },
    ]);
    const stats = await repo.getOrderStatsBySellerProfile(['sp1']);
    expect(stats.get('sp1')).toEqual({ ordersCount: 2, gmv: 150.5 });
    expect(db.order.groupBy.mock.calls[0][0].where.status).toEqual({
      notIn: ['PENDING_PAYMENT', 'CANCELLED'],
    });
  });

  it('settings read and upsert', async () => {
    db.platformSetting.findUnique.mockResolvedValue({ value: 25 });
    expect(await repo.findSettingValue('k')).toBe(25);
    await repo.upsertSetting('k', 20);
    expect(db.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'k' },
      update: { value: 20 },
      create: { key: 'k', value: 20 },
    });
  });
});
