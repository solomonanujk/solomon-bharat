import { describe, it, expect } from 'vitest';
import { mapImportRow } from './applicationImport';

const now = new Date('2026-10-15T12:00:00Z');
const row = {
  brand: 'Swing Saga', founder: 'Juhi Jain', email: 'HELLOSWINGSAGA@GMAIL.COM', phone: '7974711689.0',
  city: 'NOIDA', country: 'India', instagram: 'myswingsagaa', followers: '575550', website: 'https://swingsaga.com',
  categories: '["Crochet","Macrame"]', product_desc: 'Swings', gi: 'Not sure', monthly_volume: '₹10,00,000–25,00,000',
  business_type: 'Manufacturer', shipped: 'Yes', intl_orders: '100+', intl_countries: 'UK, USA', amazon: 'Yes — Amazon India',
  has_iec: 'Yes, I have IEC', brand_story: 'Story', heard_from: 'Other', accepted_terms: 'TRUE',
  created_at: '2026-06-11 12:07:30.761515+00',
};

describe('mapImportRow', () => {
  it('maps a full row: lower-cased email, phone without .0, original date, agreement version', () => {
    const r = mapImportRow(2, row, now);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.data).toMatchObject({
      businessName: 'Swing Saga', contactName: 'Juhi Jain', email: 'helloswingsaga@gmail.com', phone: '7974711689',
      businessAddress: 'NOIDA, India', instagramFollowers: 575550, craftCategories: ['Crochet'],
      monthlySalesVolume: '₹10,00,000–25,00,000', approxExportOrders: '100+', shippedInternationally: true,
      brandStory: 'Story', agreedToCommissionTerms: true, commissionTermsVersion: '2026-10-13', commissionAgreedAt: now,
      status: 'PENDING', message: 'Other categories from the old form: Macrame',
    });
    expect((r.data.createdAt as Date).toISOString()).toBe('2026-06-11T12:07:30.761Z');
    expect(r.data).not.toHaveProperty('gstRegistration');
  });

  it('skips the Unnamed Brand row and fails rows missing required details', () => {
    expect(mapImportRow(3, { brand: 'Unnamed Brand' }, now).kind).toBe('skip');
    expect(mapImportRow(4, { ...row, email: '' }, now)).toMatchObject({ kind: 'fail', reason: 'Missing email' });
  });

  it('treats "None" cells as empty', () => {
    const r = mapImportRow(5, { ...row, monthly_volume: 'None', shipped: 'None' }, now);
    expect(r.kind === 'ok' && r.data.monthlySalesVolume).toBeNull();
    expect(r.kind === 'ok' && r.data.shippedInternationally).toBeNull();
  });
});
