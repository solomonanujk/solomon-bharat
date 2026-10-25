import { describe, expect, it } from 'vitest';
import { AudienceCandidate, buildVariables, csvLookupKey, csvLookupKeys, resolveAudience } from './bulk-messages.audience';
import { AudienceSpec } from './bulk-messages.validation';

const seller = (over: Partial<AudienceCandidate> & { id: string }): AudienceCandidate => ({
  businessName: `Biz ${over.id}`,
  contactName: `Contact ${over.id}`,
  phone: '+910000000000',
  whatsappNumber: `+91981234${over.id.padStart(4, '0')}`,
  whatsappOptedOutAt: null,
  user: { email: `${over.id}@example.com`, status: 'ACTIVE' },
  ...over,
});

const all: AudienceSpec = { mode: 'ALL_LINKED' };

describe('resolveAudience', () => {
  it('keeps only linked, active, opted-in sellers and counts everyone else', () => {
    const { recipients, skipped } = resolveAudience(
      [
        seller({ id: '1' }),
        seller({ id: '2', whatsappNumber: null }),
        seller({ id: '3', whatsappOptedOutAt: new Date() }),
        seller({ id: '4', user: { email: 'x@example.com', status: 'SUSPENDED' } }),
        seller({ id: '5' }),
      ],
      all,
    );
    expect(recipients.map((r) => r.sellerId)).toEqual(['1', '5']);
    expect(skipped).toMatchObject({ notLinked: 1, optedOut: 1, suspended: 1, unmatched: 0, duplicate: 0 });
  });

  it('sends to the verified WhatsApp number, not the registered phone', () => {
    const { recipients } = resolveAudience([seller({ id: '1', phone: '+911111111111', whatsappNumber: '+919999999999' })], all);
    expect(recipients[0].phone).toBe('+919999999999');
  });

  it('never messages a number that is not on a registered seller (CSV)', () => {
    const spec: AudienceSpec = {
      mode: 'CSV',
      csvKeyColumn: 'contact',
      csvRows: [{ contact: '+919812340001' }, { contact: '+919000000000' }, { contact: '' }],
    };
    const { recipients, skipped } = resolveAudience([seller({ id: '1' })], spec);
    expect(recipients.map((r) => r.sellerId)).toEqual(['1']);
    expect(skipped.unmatched).toBe(2);
  });

  it('matches CSV rows by email, WhatsApp number or registered phone and keeps the row for variables', () => {
    const spec: AudienceSpec = {
      mode: 'CSV',
      csvKeyColumn: 'who',
      csvRows: [{ who: '1@EXAMPLE.com', amount: '500' }, { who: '9812340002', amount: '700' }, { who: '+912222222222', amount: '900' }],
    };
    const { recipients } = resolveAudience(
      [
        seller({ id: '1' }),
        seller({ id: '2', whatsappNumber: '+919812340002' }),
        seller({ id: '3', phone: '+912222222222', whatsappNumber: '+919812340003' }),
      ],
      spec,
    );
    expect(recipients.map((r) => [r.sellerId, r.csvRow?.amount])).toEqual([['1', '500'], ['2', '700'], ['3', '900']]);
  });

  it('counts a seller named twice only once', () => {
    const spec: AudienceSpec = { mode: 'CSV', csvKeyColumn: 'k', csvRows: [{ k: '1@example.com' }, { k: '+919812340001' }] };
    const { recipients, skipped } = resolveAudience([seller({ id: '1' })], spec);
    expect(recipients).toHaveLength(1);
    expect(skipped.duplicate).toBe(1);
  });
});

describe('csvLookupKeys', () => {
  it('lowercases emails, normalises numbers and ignores blanks', () => {
    expect(csvLookupKey(' Asha@Example.COM ')).toBe('asha@example.com');
    expect(csvLookupKey('+91 98123 40001')).toBe('+919812340001');
    expect(csvLookupKey('  ')).toBeNull();
    expect(csvLookupKey('abc')).toBeNull();
  });

  it('reads a bare 10-digit number as an Indian number first', () => {
    expect(csvLookupKeys('98123 40001')).toEqual(['+919812340001', '+9812340001']);
    expect(csvLookupKeys('+441234567890')).toEqual(['+441234567890']);
  });
});

describe('buildVariables', () => {
  const recipient = {
    sellerId: '1',
    phone: '+919812340001',
    businessName: 'Moradabad Brass',
    contactName: 'Asha',
    csvRow: { amount: '500\nINR', empty: '' },
  };

  it('fills each placeholder from its source, one line each', () => {
    expect(buildVariables(['seller.businessName', 'seller.contactName', 'fixed:Friday', 'csv:amount'], recipient)).toEqual([
      'Moradabad Brass',
      'Asha',
      'Friday',
      '500 INR',
    ]);
  });

  it('never returns an empty value (Meta rejects them)', () => {
    expect(buildVariables(['csv:empty', 'csv:missing'], recipient)).toEqual(['-', '-']);
  });
});
