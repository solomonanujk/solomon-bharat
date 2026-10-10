import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandStatus, Role } from '@prisma/client';
import { BrandsRepository } from './brands.repository';
import { BrandsService, toPublicBrand } from './brands.service';
import { writeAuditLog } from '../../utils/auditLog';
import { productsService } from '../products/products.service';
import { payoutsService } from '../payouts/payouts.service';
import { storageProvider } from '../../providers/storage';

vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../products/products.service', () => ({
  productsService: { invalidatePublishedListCache: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../payouts/payouts.service', () => ({
  payoutsService: { getBrandSalesStats: vi.fn() },
}));
vi.mock('../../providers/storage', () => ({
  storageProvider: { uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', publicId: 'x' }) },
}));

function buildBrand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brand-1',
    sellerProfileId: 'sp-1',
    name: 'Kala Kendra',
    slug: 'kala-kendra',
    logoUrl: 'https://cdn/logo.png',
    bannerUrl: null,
    story: 'Handmade',
    country: 'India',
    website: 'https://kk.example',
    instagram: 'kk',
    returnPolicy: '7 day',
    minOrderValueInr: 5000,
    isVerified: true,
    status: BrandStatus.ACTIVE,
    commissionFirstOverride: 20,
    commissionRepeatOverride: null,
    legalName: 'Kala Kendra Pvt Ltd',
    gstin: '29ABCDE1234F1Z5',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { products: 4, followers: 9 },
    ...overrides,
  };
}

function buildMockRepo(): BrandsRepository {
  return {
    findActive: vi.fn(),
    findActiveBySlug: vi.fn(),
    findBySlug: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    updateBrand: vi.fn(),
    findBuyerProfileId: vi.fn(),
    isFollowing: vi.fn(),
    followBrand: vi.fn(),
    unfollowBrand: vi.fn(),
    findFollowedBrands: vi.fn(),
    findAllForAdmin: vi.fn(),
    getOrderStatsBySellerProfile: vi.fn(),
    findSettingValue: vi.fn(),
    upsertSetting: vi.fn(),
  } as unknown as BrandsRepository;
}

describe('BrandsService', () => {
  let repo: BrandsRepository;
  let service: BrandsService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = buildMockRepo();
    service = new BrandsService(repo);
  });

  describe('public detail', () => {
    it('returns only whitelisted fields — never legalName, gstin, status or rate overrides', async () => {
      vi.mocked(repo.findActiveBySlug).mockResolvedValue(buildBrand() as never);

      const result = await service.getPublicBySlug('kala-kendra');

      expect(Object.keys(result).sort()).toEqual(
        [
          'id',
          'name',
          'slug',
          'logoUrl',
          'bannerUrl',
          'story',
          'country',
          'website',
          'instagram',
          'returnPolicy',
          'isVerified',
          'minOrderValueInr',
          'productCount',
          'followerCount',
          'isFollowing',
        ].sort(),
      );
      expect(JSON.stringify(result)).not.toContain('Pvt Ltd');
      expect(JSON.stringify(result)).not.toContain('29ABCDE');
      expect(result.productCount).toBe(4);
      expect(result.followerCount).toBe(9);
      expect(result.minOrderValueInr).toBe(5000);
    });

    it('404s a brand page for an agent without touching the repository', async () => {
      await expect(
        service.getPublicBySlug('kala-kendra', { id: 'u3', role: Role.AGENT }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.findActiveBySlug).not.toHaveBeenCalled();
    });

    it('returns an empty brand list for an agent without querying', async () => {
      await expect(service.listPublic(undefined, { page: 1, limit: 20 }, Role.AGENT)).resolves.toEqual({
        data: [],
        total: 0,
      });
      expect(repo.findActive).not.toHaveBeenCalled();
    });

    it('404s for a suspended or unknown brand (repo only returns ACTIVE)', async () => {
      vi.mocked(repo.findActiveBySlug).mockResolvedValue(null);
      await expect(service.getPublicBySlug('gone')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('resolves isFollowing for a buyer, and is false for guests and sellers', async () => {
      vi.mocked(repo.findActiveBySlug).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.isFollowing).mockResolvedValue(true);

      expect((await service.getPublicBySlug('kala-kendra', { id: 'u1', role: Role.BUYER })).isFollowing).toBe(true);
      expect((await service.getPublicBySlug('kala-kendra')).isFollowing).toBe(false);
      expect((await service.getPublicBySlug('kala-kendra', { id: 'u2', role: Role.SELLER })).isFollowing).toBe(false);
      expect(repo.isFollowing).toHaveBeenCalledTimes(1);
    });

    it('toPublicBrand does not carry through unlisted columns', () => {
      const out = toPublicBrand(buildBrand() as never, false) as unknown as Record<string, unknown>;
      expect(out.legalName).toBeUndefined();
      expect(out.gstin).toBeUndefined();
      expect(out.commissionFirstOverride).toBeUndefined();
      expect(out.status).toBeUndefined();
    });

    it('lists brand cards with productCount', async () => {
      vi.mocked(repo.findActive).mockResolvedValue({ data: [buildBrand()], total: 1 } as never);
      const { data, total } = await service.listPublic(undefined, { page: 1, limit: 20 });
      expect(total).toBe(1);
      expect(data[0]).toEqual({
        id: 'brand-1',
        name: 'Kala Kendra',
        slug: 'kala-kendra',
        logoUrl: 'https://cdn/logo.png',
        isVerified: true,
        country: 'India',
        productCount: 4,
      });
    });
  });

  describe('follow', () => {
    it('follows an active brand (upsert makes repeats idempotent)', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.findActiveBySlug).mockResolvedValue(buildBrand() as never);

      await service.follow('u1', 'kala-kendra');
      await service.follow('u1', 'kala-kendra');

      expect(repo.followBrand).toHaveBeenCalledTimes(2);
      expect(repo.followBrand).toHaveBeenCalledWith('buyer-1', 'brand-1');
    });

    it('cannot follow a suspended/unknown brand', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.findActiveBySlug).mockResolvedValue(null);
      await expect(service.follow('u1', 'x')).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.followBrand).not.toHaveBeenCalled();
    });

    it('404s when the user has no buyer profile', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue(null);
      await expect(service.follow('u1', 'x')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('unfollow succeeds even when not following, and works for suspended brands', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.findBySlug).mockResolvedValue(buildBrand({ status: BrandStatus.SUSPENDED }) as never);

      const result = await service.unfollow('u1', 'kala-kendra');

      expect(result).toEqual({ isFollowing: false });
      expect(repo.unfollowBrand).toHaveBeenCalledWith('buyer-1', 'brand-1');
    });

    it('unfollow of an unknown brand is a 404', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.findBySlug).mockResolvedValue(null);
      await expect(service.unfollow('u1', 'nope')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('lists followed brands', async () => {
      vi.mocked(repo.findBuyerProfileId).mockResolvedValue('buyer-1');
      vi.mocked(repo.findFollowedBrands).mockResolvedValue({ data: [buildBrand()], total: 1 } as never);
      const res = await service.listFollowing('u1', { page: 1, limit: 20 });
      expect(res.data).toHaveLength(1);
    });
  });

  describe('own brand', () => {
    it('getMyBrand includes private fields and read-only overrides', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);
      const result = await service.getMyBrand('u1');
      expect(result.legalName).toBe('Kala Kendra Pvt Ltd');
      expect(result.gstin).toBe('29ABCDE1234F1Z5');
      expect(result.commissionFirstOverride).toBe(20);
      expect(result.commissionRepeatOverride).toBeNull();
    });

    it('getMyBrand returns effectiveCommission: override ?? platform default', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findSettingValue).mockImplementation((key: string) =>
        Promise.resolve(key.endsWith('repeat') ? 12 : 30),
      );
      const result = await service.getMyBrand('u1');
      // first: brand override 20 beats default 30; repeat: no override, platform default 12
      expect(result.effectiveCommission).toEqual({ first: 20, repeat: 12 });
    });

    it('getMyBrand effectiveCommission falls back to 25/15 with no override or setting', async () => {
      const plain = buildBrand({ commissionFirstOverride: null, commissionRepeatOverride: null });
      vi.mocked(repo.findByUserId).mockResolvedValue(plain as never);
      vi.mocked(repo.findById).mockResolvedValue(plain as never);
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);
      expect((await service.getMyBrand('u1')).effectiveCommission).toEqual({ first: 25, repeat: 15 });
    });

    it('404s when the seller has no brand', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(null);
      await expect(service.getMyBrand('u1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('updateMyBrand persists and invalidates the product list cache', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.updateBrand).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);

      await service.updateMyBrand('u1', { story: 'New story' });

      expect(repo.updateBrand).toHaveBeenCalledWith('brand-1', { story: 'New story' });
      expect(productsService.invalidatePublishedListCache).toHaveBeenCalled();
    });

    it('uploads an image into the brand folder and returns the url', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      const result = await service.uploadMyBrandImage('u1', 'logo', {
        buffer: Buffer.from('x'),
        originalname: 'l.png',
      });
      expect(result).toEqual({ url: 'https://cdn/x.png' });
      expect(storageProvider.uploadImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('logo'),
        expect.stringContaining('brands/kala-kendra'),
      );
    });

    it('rejects a missing or oversized upload', async () => {
      await expect(service.uploadMyBrandImage('u1', 'logo', undefined)).rejects.toMatchObject({ statusCode: 400 });
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      await expect(
        service.uploadMyBrandImage('u1', 'banner', { buffer: Buffer.alloc(6 * 1024 * 1024), originalname: 'b.png' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('stats delegate to payoutsService with the seller profile id', async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(buildBrand() as never);
      vi.mocked(payoutsService.getBrandSalesStats).mockResolvedValue({ ordersCount: 2 } as never);
      const result = await service.getMyStats('u1');
      expect(payoutsService.getBrandSalesStats).toHaveBeenCalledWith('sp-1');
      expect(result).toEqual({ ordersCount: 2 });
    });
  });

  describe('admin', () => {
    it('lists brands with seller contact, counts and order stats', async () => {
      vi.mocked(repo.findAllForAdmin).mockResolvedValue({
        data: [
          buildBrand({
            sellerProfile: {
              id: 'sp-1',
              businessName: 'KK',
              contactName: 'Meera',
              phone: '1',
              user: { email: 'm@kk.in' },
            },
          }),
        ],
        total: 1,
      } as never);
      vi.mocked(repo.getOrderStatsBySellerProfile).mockResolvedValue(
        new Map([['sp-1', { ordersCount: 3, gmv: 900 }]]),
      );

      const { data } = await service.listForAdmin({}, { page: 1, limit: 20 });

      expect(data[0].seller.email).toBe('m@kk.in');
      expect(data[0].productCount).toBe(4);
      expect(data[0].orderStats).toEqual({ ordersCount: 3, gmv: 900 });
      expect(data[0].commissionFirstOverride).toBe(20);
    });

    it('verifying a brand audit-logs BRAND_VERIFIED and invalidates the cache', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildBrand({ isVerified: false }) as never);
      vi.mocked(repo.updateBrand).mockResolvedValue(buildBrand() as never);

      await service.updateForAdmin('admin-1', 'brand-1', { isVerified: true });

      expect(repo.updateBrand).toHaveBeenCalledWith('brand-1', { isVerified: true });
      expect(writeAuditLog).toHaveBeenCalledWith('admin-1', 'BRAND_VERIFIED', 'Brand', 'brand-1', expect.anything());
      expect(productsService.invalidatePublishedListCache).toHaveBeenCalled();
    });

    it('suspending audit-logs BRAND_SUSPENDED', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.updateBrand).mockResolvedValue(buildBrand() as never);

      await service.updateForAdmin('admin-1', 'brand-1', { status: BrandStatus.SUSPENDED });

      expect(writeAuditLog).toHaveBeenCalledWith('admin-1', 'BRAND_SUSPENDED', 'Brand', 'brand-1', expect.anything());
    });

    it('commission override is validated (0-100), audit-logged, and does not touch the product cache', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.updateBrand).mockResolvedValue(buildBrand() as never);

      await expect(
        service.updateForAdmin('admin-1', 'brand-1', { commissionFirstOverride: 101 }),
      ).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        service.updateForAdmin('admin-1', 'brand-1', { commissionRepeatOverride: -1 }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(repo.updateBrand).not.toHaveBeenCalled();

      await service.updateForAdmin('admin-1', 'brand-1', { commissionRepeatOverride: 10, commissionFirstOverride: null });

      expect(repo.updateBrand).toHaveBeenCalledWith('brand-1', {
        commissionRepeatOverride: 10,
        commissionFirstOverride: null,
      });
      expect(writeAuditLog).toHaveBeenCalledWith(
        'admin-1',
        'BRAND_COMMISSION_OVERRIDDEN',
        'Brand',
        'brand-1',
        expect.objectContaining({ repeat: { from: null, to: 10 }, first: { from: 20, to: null } }),
      );
      expect(productsService.invalidatePublishedListCache).not.toHaveBeenCalled();
    });

    it('a no-op patch writes nothing', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      await service.updateForAdmin('admin-1', 'brand-1', { isVerified: true });
      expect(repo.updateBrand).not.toHaveBeenCalled();
      expect(writeAuditLog).not.toHaveBeenCalled();
    });

    it('404s for an unknown brand', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.updateForAdmin('a', 'x', { isVerified: true })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('commission', () => {
    it('defaults to 25/15 when no setting exists', async () => {
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);
      expect(await service.getCommissionDefaults()).toEqual({ first: 25, repeat: 15 });
    });

    it('reads stored settings (number or { value })', async () => {
      vi.mocked(repo.findSettingValue).mockResolvedValueOnce(30).mockResolvedValueOnce({ value: 12 });
      expect(await service.getCommissionDefaults()).toEqual({ first: 30, repeat: 12 });
    });

    it('setCommissionDefaults validates, stores both keys and audit-logs', async () => {
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);

      await expect(service.setCommissionDefaults('a', { first: 120, repeat: 10 })).rejects.toMatchObject({
        statusCode: 422,
      });

      await service.setCommissionDefaults('admin-1', { first: 22, repeat: 12 });

      expect(repo.upsertSetting).toHaveBeenCalledWith('marketplace_commission_first', 22);
      expect(repo.upsertSetting).toHaveBeenCalledWith('marketplace_commission_repeat', 12);
      expect(writeAuditLog).toHaveBeenCalledWith(
        'admin-1',
        'MARKETPLACE_COMMISSION_DEFAULTS_UPDATED',
        'PlatformSetting',
        expect.any(String),
        { from: { first: 25, repeat: 15 }, to: { first: 22, repeat: 12 } },
      );
    });

    it('resolveCommissionRates: override wins, else default', async () => {
      vi.mocked(repo.findById).mockResolvedValue(buildBrand() as never);
      vi.mocked(repo.findSettingValue).mockResolvedValue(null);
      expect(await service.resolveCommissionRates('brand-1')).toEqual({ first: 20, repeat: 15 });
    });

    it('resolveCommissionRates 404s for an unknown brand', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.resolveCommissionRates('x')).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
