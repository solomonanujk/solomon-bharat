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

describe('submitApplicationSchema', () => {
  it('needs the instagram fields', () => {
    const ok = submitApplicationSchema.safeParse({ ...common, instagramHandle: 'kk', instagramFollowers: 10 });
    expect(ok.success).toBe(true);
    expect(submitApplicationSchema.safeParse(common).success).toBe(false);
  });

  it('strips any marketplace fields an old client still sends', () => {
    const ok = submitApplicationSchema.safeParse({
      ...common,
      instagramHandle: 'kk',
      instagramFollowers: 10,
      sellerType: 'MARKETPLACE',
      brandName: 'Kala Kendra',
      minOrderValueInr: 5000,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).not.toHaveProperty('sellerType');
      expect(ok.data).not.toHaveProperty('brandName');
      expect(ok.data).not.toHaveProperty('minOrderValueInr');
    }
  });

  it('requires agreedToCommissionTerms to be literally true', () => {
    expect(
      submitApplicationSchema.safeParse({ ...common, instagramHandle: 'kk', instagramFollowers: 10, agreedToCommissionTerms: false }).success,
    ).toBe(false);
  });
});
