import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../products/products.service', () => ({ productsService: { listForAdmin: vi.fn() } }));

import { productsService } from '../products/products.service';
import { WhatsAppAdminService, toLiveListing } from './whatsapp.admin.service';

const session = {
  sellerId: 's1',
  phone: '+919812345678',
  state: 'AWAITING_ANSWERS',
  language: 'hinglish',
  texts: ['pital ka diya, 250 rupaye'],
  imageUrls: ['a', 'b', 'c'],
  videoUrls: ['v'],
  collected: { name: 'Brass Diya', categoryPath: 'Home > Decor > Brass Lamps', price: 250 },
  missing: ['weight', 'hsn'],
  aiCalls: 1,
  createdAt: new Date('2026-10-25T09:00:00Z'),
  lastMessageAt: new Date('2026-10-25T09:05:00Z'),
  expiresAt: new Date('2026-10-26T09:05:00Z'),
  seller: { businessName: 'Moradabad Brass' },
};

describe('toLiveListing', () => {
  it('summarises the draft and never exposes the seller\'s raw messages', () => {
    const live = toLiveListing(session as never);
    expect(live).toMatchObject({
      businessName: 'Moradabad Brass',
      productName: 'Brass Diya',
      categoryPath: 'Home > Decor > Brass Lamps',
      missing: ['weight', 'hsn'],
      photoCount: 3,
      videoCount: 1,
      aiCalls: 1,
    });
    expect(JSON.stringify(live)).not.toContain('pital ka diya');
    expect(live).not.toHaveProperty('texts');
  });

  it('copes with an empty draft', () => {
    const live = toLiveListing({ ...session, collected: {} } as never);
    expect(live.productName).toBeNull();
    expect(live.categoryPath).toBeNull();
  });
});

describe('WhatsAppAdminService', () => {
  const repo = {
    countPendingProducts: vi.fn(),
    countLiveSessions: vi.fn(),
    countLinkedSellers: vi.fn(),
    findLiveSessions: vi.fn(),
    findLinkedSellers: vi.fn(),
    countWhatsAppProductsBySeller: vi.fn(),
    aiCallsOn: vi.fn(),
  };
  let service: WhatsAppAdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppAdminService(repo as never);
  });

  it('summary combines the three counts', async () => {
    repo.countPendingProducts.mockResolvedValue(2);
    repo.countLiveSessions.mockResolvedValue(1);
    repo.countLinkedSellers.mockResolvedValue(4);
    expect(await service.summary()).toEqual({ pendingProducts: 2, liveListings: 1, linkedSellers: 4 });
  });

  it('products always asks for WhatsApp-sourced products, whatever the caller passes', async () => {
    vi.mocked(productsService.listForAdmin).mockResolvedValue({ data: [], total: 0 } as never);
    await service.products({ approvalStatus: 'PENDING' as never, sellerId: 's1' }, { page: 1, limit: 20 });
    expect(productsService.listForAdmin).toHaveBeenCalledWith(
      { approvalStatus: 'PENDING', sellerId: 's1', source: 'WHATSAPP' },
      { page: 1, limit: 20 },
    );
  });

  it('linkedSellers adds product and AI-call counts, defaulting to zero', async () => {
    repo.findLinkedSellers.mockResolvedValue({
      data: [
        { id: 's1', businessName: 'A', whatsappNumber: '+911', whatsappVerifiedAt: new Date('2026-10-20') },
        { id: 's2', businessName: 'B', whatsappNumber: '+912', whatsappVerifiedAt: null },
      ],
      total: 2,
    });
    repo.countWhatsAppProductsBySeller.mockResolvedValue(new Map([['s1', 3]]));
    repo.aiCallsOn.mockResolvedValue(new Map([['s1', 5]]));
    const { data, total } = await service.linkedSellers({}, { page: 1, limit: 20 });
    expect(total).toBe(2);
    expect(data[0]).toMatchObject({ sellerId: 's1', productsByChat: 3, aiCallsToday: 5 });
    expect(data[1]).toMatchObject({ sellerId: 's2', productsByChat: 0, aiCallsToday: 0, linkedAt: null });
  });
});
