import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { PaymentProvider } from './paymentProvider.types';
import { PayPalPaymentProvider } from './paypalPaymentProvider';
import { MockPaymentProvider } from './mockPaymentProvider';
import { UnconfiguredPaymentProvider } from './unconfiguredPaymentProvider';

export interface PaymentProviderConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  webhookId: string;
  nodeEnv: 'development' | 'test' | 'production';
}

/** PayPal when credentials exist; the auto-approving mock only outside production (fail closed there). */
export function createPaymentProvider(cfg: PaymentProviderConfig): PaymentProvider {
  if (cfg.clientId && cfg.clientSecret) {
    return new PayPalPaymentProvider(cfg.clientId, cfg.clientSecret, cfg.mode, cfg.webhookId);
  }
  if (cfg.nodeEnv === 'production') {
    logger.error('PayPal credentials are missing in production - payments are disabled (mock provider refused)');
    return new UnconfiguredPaymentProvider();
  }
  return new MockPaymentProvider();
}

export const paymentProvider: PaymentProvider = createPaymentProvider({
  clientId: env.PAYPAL_CLIENT_ID,
  clientSecret: env.PAYPAL_CLIENT_SECRET,
  mode: env.PAYPAL_MODE,
  webhookId: env.PAYPAL_WEBHOOK_ID,
  nodeEnv: env.NODE_ENV,
});

export * from './paymentProvider.types';
