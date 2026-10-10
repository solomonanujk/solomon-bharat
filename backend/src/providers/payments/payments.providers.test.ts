import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const envState = vi.hoisted(() => ({ production: false }));

vi.mock('../../config/env', () => ({
  env: {
    PAYPAL_CLIENT_ID: '',
    PAYPAL_CLIENT_SECRET: '',
    PAYPAL_MODE: 'sandbox',
    PAYPAL_WEBHOOK_ID: '',
    NODE_ENV: 'test',
  },
  get isProduction() {
    return envState.production;
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createPaymentProvider } from './index';
import { MockPaymentProvider } from './mockPaymentProvider';
import { PayPalPaymentProvider } from './paypalPaymentProvider';
import { UnconfiguredPaymentProvider } from './unconfiguredPaymentProvider';

const base = { clientId: '', clientSecret: '', mode: 'sandbox' as const, webhookId: '' };

describe('createPaymentProvider', () => {
  it('uses PayPal when credentials are present, in any environment', () => {
    for (const nodeEnv of ['development', 'test', 'production'] as const) {
      expect(createPaymentProvider({ ...base, clientId: 'id', clientSecret: 'secret', nodeEnv })).toBeInstanceOf(
        PayPalPaymentProvider,
      );
    }
  });

  it('falls back to the auto-approving mock outside production', () => {
    expect(createPaymentProvider({ ...base, nodeEnv: 'development' })).toBeInstanceOf(MockPaymentProvider);
    expect(createPaymentProvider({ ...base, nodeEnv: 'test' })).toBeInstanceOf(MockPaymentProvider);
  });

  it('FAILS CLOSED in production when credentials are missing (never the mock)', async () => {
    for (const creds of [{}, { clientId: 'id' }, { clientSecret: 'secret' }]) {
      const provider = createPaymentProvider({ ...base, ...creds, nodeEnv: 'production' });
      expect(provider).toBeInstanceOf(UnconfiguredPaymentProvider);
      expect(provider).not.toBeInstanceOf(MockPaymentProvider);
      await expect(provider.createOrder({ amount: 1, currency: 'USD', referenceId: 'x' })).rejects.toMatchObject({
        statusCode: 503,
      });
      await expect(provider.captureOrder('x')).rejects.toMatchObject({ statusCode: 503 });
      expect(await provider.verifyWebhook({}, '{}')).toBe(false);
    }
  });
});

describe('MockPaymentProvider', () => {
  it('skips webhook verification', async () => {
    expect(await new MockPaymentProvider().verifyWebhook()).toBe(true);
  });
});

describe('PayPalPaymentProvider.verifyWebhook', () => {
  const fetchMock = vi.fn();
  const headers = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/cert',
    'paypal-transmission-id': 'tid',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-10-09T00:00:00Z',
  };
  const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    envState.production = false;
  });
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (payload: unknown, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => payload });

  it('without PAYPAL_WEBHOOK_ID: rejected in production, allowed (skipped) elsewhere', async () => {
    const provider = new PayPalPaymentProvider('id', 'secret', 'sandbox', '');
    envState.production = true;
    expect(await provider.verifyWebhook(headers, body)).toBe(false);
    envState.production = false;
    expect(await provider.verifyWebhook(headers, body)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls PayPal verify-webhook-signature with the transmission headers and webhook id', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ verification_status: 'SUCCESS' }));
    const provider = new PayPalPaymentProvider('id', 'secret', 'sandbox', 'WH-ID');

    expect(await provider.verifyWebhook(headers, body)).toBe(true);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature');
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      auth_algo: 'SHA256withRSA',
      transmission_id: 'tid',
      transmission_sig: 'sig',
      webhook_id: 'WH-ID',
      webhook_event: { event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('uses the live API host in live mode', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ verification_status: 'SUCCESS' }));
    await new PayPalPaymentProvider('id', 'secret', 'live', 'WH-ID').verifyWebhook(headers, body);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api-m.paypal.com/v1/notifications/verify-webhook-signature');
  });

  it('returns false on a FAILURE verdict, an HTTP error, a network error or a non-JSON body', async () => {
    const provider = new PayPalPaymentProvider('id', 'secret', 'sandbox', 'WH-ID');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ verification_status: 'FAILURE' }));
    expect(await provider.verifyWebhook(headers, body)).toBe(false);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({}, false));
    expect(await provider.verifyWebhook(headers, body)).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await provider.verifyWebhook(headers, body)).toBe(false);

    expect(await provider.verifyWebhook(headers, 'not json')).toBe(false);
  });
});
