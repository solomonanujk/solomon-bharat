import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SellerType } from '@prisma/client';
import { SellersRepository } from './sellers.repository';
import { SellersService } from './sellers.service';
import { writeAuditLog } from '../../utils/auditLog';

vi.mock('../../providers/mail', () => ({ mailProvider: { sendMail: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../utils/cache', () => ({ cache: {}, bumpVersion: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../notifications/notifications.service', () => ({
  notificationsService: { notify: vi.fn().mockResolvedValue(undefined) },
}));

function harness(seller: Record<string, unknown> | null, openOrders = 0) {
  const repo = {
    findSellerWithBrand: vi.fn().mockResolvedValue(seller),
    countOpenOrdersForSeller: vi.fn().mockResolvedValue(openOrders),
    switchToMarketplace: vi.fn().mockResolvedValue({ brandId: 'brand-new', productCount: 3 }),
    switchToCurated: vi.fn().mockResolvedValue({ productCount: 2 }),
    brandSlugExists: vi.fn().mockResolvedValue(false),
    findUserById: vi.fn().mockResolvedValue({ id: 'u1', email: 's@x.com' }),
  } as unknown as SellersRepository;
  return { repo, service: new SellersService(repo) };
}

const curated = { id: 'sp1', userId: 'u1', businessName: 'Jaipur Crafts', sellerType: SellerType.CURATED, brand: null };
const brandSeller = { id: 'sp1', userId: 'u1', businessName: 'Jaipur Crafts', sellerType: SellerType.MARKETPLACE, brand: { id: 'b1', name: 'Kala' } };

describe('SellersService.switchSellerType', () => {
  beforeEach(() => vi.clearAllMocks());

  it('curated -> marketplace creates a brand from the business name and moves products', async () => {
    const { repo, service } = harness(curated);
    const r = await service.switchSellerType('admin', 'sp1', SellerType.MARKETPLACE);
    expect(repo.switchToMarketplace).toHaveBeenCalledWith('sp1', { name: 'Jaipur Crafts', slug: 'jaipur-crafts' });
    expect(r).toEqual({ sellerType: SellerType.MARKETPLACE, productCount: 3, brandId: 'brand-new' });
    expect(writeAuditLog).toHaveBeenCalledWith('admin', 'SELLER_TYPE_SWITCHED', 'SellerProfile', 'sp1', expect.objectContaining({ from: 'CURATED', to: 'MARKETPLACE' }));
  });

  it('reuses (reactivates) an earlier brand when switching back to marketplace', async () => {
    const { repo, service } = harness({ ...curated, brand: { id: 'b-old', name: 'Old Brand' } });
    await service.switchSellerType('admin', 'sp1', SellerType.MARKETPLACE);
    expect(repo.switchToMarketplace).toHaveBeenCalledWith('sp1', { existingId: 'b-old', name: 'Old Brand' });
  });

  it('marketplace -> curated suspends the brand and sends products back to review', async () => {
    const { repo, service } = harness(brandSeller);
    const r = await service.switchSellerType('admin', 'sp1', SellerType.CURATED);
    expect(repo.switchToCurated).toHaveBeenCalledWith('sp1', 'b1');
    expect(r.productCount).toBe(2);
  });

  it('refuses while the seller has orders in progress', async () => {
    const { repo, service } = harness(curated, 2);
    await expect(service.switchSellerType('admin', 'sp1', SellerType.MARKETPLACE)).rejects.toThrow(/2 orders in progress/);
    expect(repo.switchToMarketplace).not.toHaveBeenCalled();
  });

  it('refuses a switch to the type the seller already has, and an unknown seller', async () => {
    await expect(harness(curated).service.switchSellerType('admin', 'sp1', SellerType.CURATED)).rejects.toThrow(/already Curated/);
    await expect(harness(null).service.switchSellerType('admin', 'sp1', SellerType.CURATED)).rejects.toThrow(/not found/);
  });
});

describe('SellersService.deleteApplication', () => {
  function appHarness(status: string) {
    const repo = {
      findApplicationById: vi.fn().mockResolvedValue({ id: 'a1', status, businessName: 'T', email: 't@x.com' }),
      deleteApplication: vi.fn().mockResolvedValue(undefined),
    } as unknown as SellersRepository;
    return { repo, service: new SellersService(repo) };
  }

  it('deletes a rejected application and audit-logs it', async () => {
    const { repo, service } = appHarness('REJECTED');
    await service.deleteApplication('a1', 'admin');
    expect(repo.deleteApplication).toHaveBeenCalledWith('a1');
    expect(writeAuditLog).toHaveBeenCalledWith('admin', 'SELLER_APPLICATION_DELETED', 'SellerApplication', 'a1', expect.any(Object));
  });

  it('never deletes an approved application', async () => {
    const { repo, service } = appHarness('APPROVED');
    await expect(service.deleteApplication('a1', 'admin')).rejects.toThrow(/cannot be deleted/);
    expect(repo.deleteApplication).not.toHaveBeenCalled();
  });
});
