import { describe, it, expect, beforeEach } from 'vitest';
import { Role } from '@prisma/client';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { SellersRepository } from './sellers.repository';

describe('SellersRepository', () => {
  let db: MockPrismaClient;
  let repo: SellersRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      sellerApplication: mockModel(),
      user: mockModel(),
      sellerProfile: mockModel(),
      platformSetting: mockModel(),
      brand: mockModel(),
    });
    repo = new SellersRepository(db as never);
  });

  it('createApplication passes the input straight through as data', async () => {
    db.sellerApplication.create.mockResolvedValue({ id: 'app-1' });
    await repo.createApplication({ businessName: 'Kala Kendra' } as never);
    expect(db.sellerApplication.create).toHaveBeenCalledWith({ data: { businessName: 'Kala Kendra' } });
  });

  it('findLatestApplicationByEmail orders by most recent', async () => {
    db.sellerApplication.findFirst.mockResolvedValue({ id: 'app-1' });
    await repo.findLatestApplicationByEmail('a@b.com');
    expect(db.sellerApplication.findFirst).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findApplications applies a status filter when given', async () => {
    db.sellerApplication.findMany.mockResolvedValue([]);
    db.sellerApplication.count.mockResolvedValue(0);
    await repo.findApplications({ status: 'PENDING' as never }, { page: 1, limit: 20 });
    const arg = db.sellerApplication.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: 'PENDING' });
  });

  it('findApplications queries all when no status filter is given', async () => {
    db.sellerApplication.findMany.mockResolvedValue([]);
    db.sellerApplication.count.mockResolvedValue(0);
    await repo.findApplications({}, { page: 1, limit: 20 });
    const arg = db.sellerApplication.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({});
  });

  it('updateApplication updates only the given fields', async () => {
    db.sellerApplication.update.mockResolvedValue({ id: 'app-1' });
    await repo.updateApplication('app-1', { status: 'APPROVED' as never });
    expect(db.sellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { status: 'APPROVED' },
    });
  });

  it('createSellerUserAndProfile creates a SELLER user with a nested seller profile', async () => {
    db.user.create.mockResolvedValue({
      id: 'u1',
      sellerProfile: { id: 'sp1' },
    });

    const application = {
      id: 'app-1',
      email: 'a@b.com',
      businessName: 'Kala Kendra',
      contactName: 'Meera',
      phone: '123',
      businessAddress: '221B Baker St',
    } as never;

    const result = await repo.createSellerUserAndProfile(application, 'hashed');

    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        email: 'a@b.com',
        passwordHash: 'hashed',
        role: Role.SELLER,
        emailVerifiedAt: expect.any(Date),
        sellerProfile: {
          create: {
            applicationId: 'app-1',
            businessName: 'Kala Kendra',
            contactName: 'Meera',
            phone: '123',
            businessAddress: '221B Baker St',
            sellerType: 'CURATED',
          },
        },
      },
      include: { sellerProfile: { include: { brand: true } } },
    });
    expect(result.profile).toEqual({ id: 'sp1' });
    expect(result.brand).toBeNull();
  });

  it('createSellerUserAndProfile nests a Brand create for a MARKETPLACE application', async () => {
    db.user.create.mockResolvedValue({ id: 'u1', sellerProfile: { id: 'sp1', brand: { id: 'b1' } } });

    const application = {
      id: 'app-1',
      email: 'a@b.com',
      businessName: 'Kala Kendra Pvt',
      contactName: 'Meera',
      phone: '123',
      businessAddress: 'Jaipur, India',
      country: 'India',
      sellerType: 'MARKETPLACE',
      brandName: 'Kala Kendra',
      brandLogoUrl: 'https://x/logo.png',
      brandStory: 'story',
      minOrderValueInr: 5000,
    } as never;

    const result = await repo.createSellerUserAndProfile(application, 'hashed', 'kala-kendra');

    const data = db.user.create.mock.calls[0][0].data.sellerProfile.create;
    expect(data.sellerType).toBe('MARKETPLACE');
    expect(data.brand.create).toMatchObject({
      name: 'Kala Kendra',
      slug: 'kala-kendra',
      logoUrl: 'https://x/logo.png',
      story: 'story',
      country: 'India',
      minOrderValueInr: 5000,
    });
    expect(result.brand).toEqual({ id: 'b1' });
  });

  it('brandSlugExists reports whether the slug is taken', async () => {
    db.brand.count.mockResolvedValue(1);
    expect(await repo.brandSlugExists('x')).toBe(true);
    db.brand.count.mockResolvedValue(0);
    expect(await repo.brandSlugExists('y')).toBe(false);
  });

  it('findSellerProfileWithBrandByUserId includes the brand', async () => {
    db.sellerProfile.findUnique.mockResolvedValue({ id: 'sp1' });
    await repo.findSellerProfileWithBrandByUserId('u1');
    expect(db.sellerProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' }, include: { brand: true } });
  });

  it('createHouseSellerUserAndProfile creates a SELLER user with no applicationId', async () => {
    db.user.create.mockResolvedValue({ id: 'house-u1', sellerProfile: { id: 'house-sp1' } });

    await repo.createHouseSellerUserAndProfile({
      email: 'house@solomonbharat.internal',
      passwordHash: 'hashed',
      businessName: 'Solomon Bharat',
      contactName: 'Solomon Bharat',
      phone: 'N/A',
      businessAddress: 'N/A',
    });

    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        email: 'house@solomonbharat.internal',
        passwordHash: 'hashed',
        role: Role.SELLER,
        emailVerifiedAt: expect.any(Date),
        sellerProfile: {
          create: {
            businessName: 'Solomon Bharat',
            contactName: 'Solomon Bharat',
            phone: 'N/A',
            businessAddress: 'N/A',
          },
        },
      },
      include: { sellerProfile: true },
    });
  });

  it('findPlatformSettingValue returns the stored value, or null when absent', async () => {
    db.platformSetting.findUnique.mockResolvedValue({ key: 'house_seller_profile_id', value: { sellerId: 'sp1' } });
    await expect(repo.findPlatformSettingValue('house_seller_profile_id')).resolves.toEqual({ sellerId: 'sp1' });

    db.platformSetting.findUnique.mockResolvedValue(null);
    await expect(repo.findPlatformSettingValue('missing_key')).resolves.toBeNull();
  });

  it('upsertPlatformSetting creates or updates by key', async () => {
    await repo.upsertPlatformSetting('house_seller_profile_id', { sellerId: 'sp1' });
    expect(db.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'house_seller_profile_id' },
      update: { value: { sellerId: 'sp1' } },
      create: { key: 'house_seller_profile_id', value: { sellerId: 'sp1' } },
    });
  });

  it('findSellerProfileByUserId queries by userId', async () => {
    db.sellerProfile.findUnique.mockResolvedValue({ id: 'sp1' });
    await repo.findSellerProfileByUserId('u1');
    expect(db.sellerProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('findSellers scopes to non-deleted profiles and includes the user', async () => {
    db.sellerProfile.findMany.mockResolvedValue([]);
    db.sellerProfile.count.mockResolvedValue(0);
    await repo.findSellers({ page: 1, limit: 20 });
    const arg = db.sellerProfile.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: null });
    expect(arg.include).toEqual({
      user: true,
      brand: { select: { id: true, name: true, slug: true, status: true, isVerified: true } },
    });
  });

  it('findSellerWithUserById includes the related user', async () => {
    db.sellerProfile.findUnique.mockResolvedValue({ id: 'sp1' });
    await repo.findSellerWithUserById('sp1');
    expect(db.sellerProfile.findUnique).toHaveBeenCalledWith({
      where: { id: 'sp1' },
      include: {
        user: true,
        brand: { select: { id: true, name: true, slug: true, status: true, isVerified: true } },
      },
    });
  });
});
