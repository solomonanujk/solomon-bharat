import { describe, expect, it, vi } from 'vitest';
import { EMPTY_TEMPLATE_SETTINGS, createTemplateCatalog, sendWithTemplateFallback, templateParam } from './templates';
import { WhatsAppProvider } from './types';

/** Every template set up, each named after what it is for. */
const settings = {
  WHATSAPP_TEMPLATE_AUTH: 'auth_code',
  WHATSAPP_TEMPLATE_PRODUCT_APPROVED: 'product_approved',
  WHATSAPP_TEMPLATE_PRODUCT_REJECTED: 'product_rejected',
  WHATSAPP_TEMPLATE_PRICING_APPROVED: 'pricing_approved',
  WHATSAPP_TEMPLATE_PRICING_REJECTED: 'pricing_rejected',
  WHATSAPP_TEMPLATE_ORDER_STATUS: 'order_status',
  WHATSAPP_TEMPLATE_PAYOUT_PAID: 'payout_paid',
  WHATSAPP_TEMPLATE_SELLER_APPROVED: 'seller_approved',
  WHATSAPP_TEMPLATE_AGENT_APPROVED: 'agent_approved',
  WHATSAPP_TEMPLATE_NEW_MESSAGE: 'new_message',
  WHATSAPP_TEMPLATE_LANGUAGE: 'en',
};

describe('templateParam', () => {
  it('flattens line breaks and tabs, collapses spaces and trims', () => {
    expect(templateParam('Blurry\nphotos,\t\ttoo   dark  ')).toBe('Blurry photos, too dark');
  });

  it('caps the length and never returns an empty value', () => {
    expect(templateParam('x'.repeat(500), 200)).toHaveLength(200);
    expect(templateParam('   \n ')).toBe('-');
    expect(templateParam('')).toBe('-');
  });
});

describe('createTemplateCatalog', () => {
  it('builds the link-code template with the code in the body and the copy-code button', () => {
    expect(createTemplateCatalog(settings).authCode('123456')).toEqual({
      name: 'auth_code',
      language: 'en',
      body: ['123456'],
      copyCode: '123456',
    });
  });

  it('builds the approved and rejected templates with cleaned values', () => {
    const catalog = createTemplateCatalog({ ...settings, WHATSAPP_TEMPLATE_LANGUAGE: 'en_US' });
    expect(catalog.productApproved('Brass Diya')).toEqual({ name: 'product_approved', language: 'en_US', body: ['Brass Diya'] });
    expect(catalog.productRejected('Brass Diya', 'Photos are\nblurry')).toEqual({
      name: 'product_rejected',
      language: 'en_US',
      body: ['Brass Diya', 'Photos are blurry'],
    });
  });

  it('builds the pricing change templates', () => {
    const catalog = createTemplateCatalog(settings);
    expect(catalog.pricingApproved('Brass Diya')).toEqual({ name: 'pricing_approved', language: 'en', body: ['Brass Diya'] });
    expect(catalog.pricingRejected('Brass Diya', 'Price\ttoo low')).toEqual({
      name: 'pricing_rejected',
      language: 'en',
      body: ['Brass Diya', 'Price too low'],
    });
  });

  it('builds the order, payout and notice templates', () => {
    const catalog = createTemplateCatalog(settings);
    expect(catalog.orderStatus('AB12CD34', 'out for delivery')).toEqual({
      name: 'order_status',
      language: 'en',
      body: ['AB12CD34', 'out for delivery'],
    });
    expect(catalog.payoutPaid('12,500.00')).toEqual({ name: 'payout_paid', language: 'en', body: ['12,500.00'] });
    expect(catalog.sellerApproved()).toEqual({ name: 'seller_approved', language: 'en', body: [] });
    expect(catalog.agentApproved()).toEqual({ name: 'agent_approved', language: 'en', body: [] });
    expect(catalog.newMessage()).toEqual({ name: 'new_message', language: 'en', body: [] });
  });

  it('caps a very long product name', () => {
    const [name] = createTemplateCatalog(settings).productApproved('N'.repeat(200))?.body ?? [];
    expect(name).toHaveLength(60);
  });

  it('gives null for every template while nothing is set up, and defaults the language', () => {
    const catalog = createTemplateCatalog({ ...EMPTY_TEMPLATE_SETTINGS, WHATSAPP_TEMPLATE_LANGUAGE: '' });
    expect(catalog.authCode('1')).toBeNull();
    expect(catalog.productApproved('x')).toBeNull();
    expect(catalog.productRejected('x', 'y')).toBeNull();
    expect(catalog.pricingApproved('x')).toBeNull();
    expect(catalog.pricingRejected('x', 'y')).toBeNull();
    expect(catalog.orderStatus('a', 'b')).toBeNull();
    expect(catalog.payoutPaid('1')).toBeNull();
    expect(catalog.sellerApproved()).toBeNull();
    expect(catalog.agentApproved()).toBeNull();
    expect(catalog.newMessage()).toBeNull();
    expect(createTemplateCatalog({ ...EMPTY_TEMPLATE_SETTINGS, WHATSAPP_TEMPLATE_NEW_MESSAGE: 'n', WHATSAPP_TEMPLATE_LANGUAGE: '' }).newMessage()?.language).toBe('en');
  });

  it('each template works on its own', () => {
    const catalog = createTemplateCatalog({ ...EMPTY_TEMPLATE_SETTINGS, WHATSAPP_TEMPLATE_PAYOUT_PAID: 'payout_paid' });
    expect(catalog.payoutPaid('5')).not.toBeNull();
    expect(catalog.orderStatus('a', 'b')).toBeNull();
  });
});

describe('sendWithTemplateFallback', () => {
  const template = { name: 't', language: 'en', body: ['a'] };
  const build = (sendTemplate?: WhatsAppProvider['sendTemplate']) =>
    ({ sendText: vi.fn().mockResolvedValue(undefined), sendTemplate }) as unknown as WhatsAppProvider;

  it('sends the template and not the text when the template works', async () => {
    const provider = build(vi.fn().mockResolvedValue(undefined));
    await sendWithTemplateFallback(provider, '+919812345678', template, 'plain');
    expect(provider.sendTemplate).toHaveBeenCalledWith('+919812345678', template);
    expect(provider.sendText).not.toHaveBeenCalled();
  });

  it('falls back to the text when the template fails', async () => {
    const provider = build(vi.fn().mockRejectedValue(new Error('template not approved')));
    await sendWithTemplateFallback(provider, '+919812345678', template, 'plain');
    expect(provider.sendText).toHaveBeenCalledWith('+919812345678', 'plain');
  });

  it('sends the text when there is no template or the provider cannot send templates', async () => {
    const withProvider = build(vi.fn());
    await sendWithTemplateFallback(withProvider, '+919812345678', null, 'plain');
    expect(withProvider.sendTemplate).not.toHaveBeenCalled();
    expect(withProvider.sendText).toHaveBeenCalledTimes(1);

    const without = build(undefined);
    await sendWithTemplateFallback(without, '+919812345678', template, 'plain');
    expect(without.sendText).toHaveBeenCalledTimes(1);
  });

  it('throws only when the text also fails', async () => {
    const provider = build(vi.fn().mockRejectedValue(new Error('no')));
    vi.mocked(provider.sendText).mockRejectedValue(new Error('window closed'));
    await expect(sendWithTemplateFallback(provider, '+919812345678', template, 'plain')).rejects.toThrow('window closed');
  });
});
