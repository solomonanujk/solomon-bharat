import { describe, it, expect } from 'vitest';
import { submitApplicationSchema } from './sellers.validation';

const common = {
  businessName: 'Kala Kendra',
  contactName: 'Meera',
  email: 'meera@kalakendra.in',
  phone: '9876543210',
  city: 'Jaipur',
  country: 'India',
  businessType: 'Manufacturer',
  agreedToCommissionTerms: true,
};

const marketplace = {
  ...common,
  sellerType: 'MARKETPLACE',
  brandName: 'Kala Kendra',
  brandStory: 'Handmade',
  brandLogoUrl: 'https://cdn.example.com/logo.png',
  brandBannerUrl: undefined,
  brandWebsite: undefined,
  minOrderValueInr: 5000,
  commissionTermsVersion: 'marketplace-2026-10',
};

describe('submitApplicationSchema', () => {
  it('keeps the curated flow unchanged (defaults to CURATED, needs instagram)', () => {
    const ok = submitApplicationSchema.safeParse({ ...common, instagramHandle: 'kk', instagramFollowers: 10 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.sellerType).toBe('CURATED');
    expect(submitApplicationSchema.safeParse(common).success).toBe(false);
  });

  it('accepts a marketplace application without instagram fields and with undefined optional URLs', () => {
    expect(submitApplicationSchema.safeParse(marketplace).success).toBe(true);
  });

  it.each(['brandName', 'minOrderValueInr', 'commissionTermsVersion'])('requires %s for marketplace', (field) => {
    const input = { ...marketplace, [field]: undefined };
    expect(submitApplicationSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a brand name shorter than 2 or longer than 60 characters', () => {
    expect(submitApplicationSchema.safeParse({ ...marketplace, brandName: 'A' }).success).toBe(false);
    expect(submitApplicationSchema.safeParse({ ...marketplace, brandName: 'a'.repeat(61) }).success).toBe(false);
  });

  it('rejects a negative minimum order value and a story over 1000 chars', () => {
    expect(submitApplicationSchema.safeParse({ ...marketplace, minOrderValueInr: -1 }).success).toBe(false);
    expect(submitApplicationSchema.safeParse({ ...marketplace, brandStory: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('requires agreedToCommissionTerms to be literally true', () => {
    expect(submitApplicationSchema.safeParse({ ...marketplace, agreedToCommissionTerms: false }).success).toBe(false);
  });
});
