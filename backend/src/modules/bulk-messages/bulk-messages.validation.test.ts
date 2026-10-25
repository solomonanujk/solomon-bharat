import { describe, expect, it } from 'vitest';
import {
  audienceSpecSchema,
  campaignInputSchema,
  replyListQuerySchema,
  templateContentIssues,
  templateInputSchema,
} from './bulk-messages.validation';

const valid = {
  name: 'festival_offer',
  category: 'MARKETING',
  language: 'en',
  body: 'Hello {{1}}, our festival sale starts {{2}}. Reply to know more.',
  variableExamples: ['Asha', 'Friday'],
};

const issues = (patch: Record<string, unknown>) => {
  const res = templateInputSchema.safeParse({ ...valid, ...patch });
  return res.success ? [] : res.error.issues.map((i) => i.message);
};

describe('templateInputSchema', () => {
  it('accepts a good template and fills defaults', () => {
    const res = templateInputSchema.parse({ name: 'hello', body: 'Welcome to Solomon Bharat.' });
    expect(res).toMatchObject({ category: 'UTILITY', language: 'en', variableExamples: [] });
    expect(templateInputSchema.safeParse(valid).success).toBe(true);
  });

  it('only allows Meta-safe names', () => {
    expect(issues({ name: 'Festival Offer' }).length).toBeGreaterThan(0);
    expect(issues({ name: '1offer' }).length).toBeGreaterThan(0);
    expect(issues({ name: 'a'.repeat(61) }).length).toBeGreaterThan(0);
  });

  it('rejects a body that starts or ends with a variable', () => {
    expect(issues({ body: '{{1}} is here, welcome.', variableExamples: ['Asha'] }).join()).toContain('start or end with a variable');
    expect(issues({ body: 'Welcome, {{1}}', variableExamples: ['Asha'] }).join()).toContain('start or end with a variable');
  });

  it('rejects gaps and adjacent variables', () => {
    expect(issues({ body: 'Hi {{1}} and {{3}} bye.', variableExamples: ['a', 'b', 'c'] }).join()).toContain('{{2}} is missing');
    expect(issues({ body: 'Hi {{1}}{{2}} bye.', variableExamples: ['a', 'b'] }).join()).toContain('next to each other');
  });

  it('needs one non-empty example per variable', () => {
    expect(issues({ variableExamples: ['Asha'] }).join()).toContain('one example for each');
    expect(issues({ variableExamples: ['Asha', ' '] }).join()).toContain('non-empty example');
  });

  it('keeps to Meta length limits and bans variables in the header', () => {
    expect(issues({ body: 'x'.repeat(1025), variableExamples: [] }).length).toBeGreaterThan(0);
    expect(issues({ headerText: 'h'.repeat(61) }).length).toBeGreaterThan(0);
    expect(issues({ headerText: 'Hello {{1}}' }).join()).toContain('header cannot contain variables');
  });

  it('checks buttons', () => {
    expect(issues({ buttons: [{ type: 'URL', text: 'Open', url: 'http://insecure.example' }] }).join()).toContain('https');
    expect(issues({ buttons: [{ type: 'PHONE_NUMBER', text: 'Call' }] }).join()).toContain('phone number');
    expect(issues({ buttons: Array(4).fill({ type: 'QUICK_REPLY', text: 'Yes' }) }).length).toBeGreaterThan(0);
    expect(issues({ buttons: [{ type: 'QUICK_REPLY', text: 'Yes' }] })).toEqual([]);
  });

  it('exposes the content rules for the submit step too', () => {
    expect(templateContentIssues({ body: 'No variables here.', variableExamples: [] })).toEqual([]);
  });
});

describe('audienceSpecSchema', () => {
  it('needs sellers for PICKED and a key column for CSV', () => {
    expect(audienceSpecSchema.safeParse({ mode: 'PICKED' }).success).toBe(false);
    expect(audienceSpecSchema.safeParse({ mode: 'PICKED', sellerIds: ['11111111-1111-4111-8111-111111111111'] }).success).toBe(true);
    expect(audienceSpecSchema.safeParse({ mode: 'CSV', csvRows: [{ phone: '1' }] }).success).toBe(false);
    expect(audienceSpecSchema.safeParse({ mode: 'CSV', csvRows: [{ phone: '1' }], csvKeyColumn: 'phone' }).success).toBe(true);
    expect(audienceSpecSchema.safeParse({ mode: 'ALL_LINKED' }).success).toBe(true);
  });
});

describe('campaignInputSchema', () => {
  const base = { name: 'Diwali', templateId: '11111111-1111-4111-8111-111111111111', audience: { mode: 'ALL_LINKED' } };

  it('accepts seller fields, fixed text and csv columns as variable sources', () => {
    expect(
      campaignInputSchema.safeParse({ ...base, variableMapping: ['seller.businessName', 'fixed:Friday', 'csv:amount'] }).success,
    ).toBe(true);
  });

  it('rejects an unknown variable source', () => {
    expect(campaignInputSchema.safeParse({ ...base, variableMapping: ['seller.password'] }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...base, variableMapping: ['fixed:'] }).success).toBe(false);
  });
});

describe('replyListQuerySchema', () => {
  it('turns unread=true into a boolean', () => {
    expect(replyListQuerySchema.parse({ unread: 'true' }).unread).toBe(true);
    expect(replyListQuerySchema.parse({}).unread).toBeUndefined();
  });
});
