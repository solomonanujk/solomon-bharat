import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { PaymentProvider } from './paymentProvider.types';
import { PayPalPaymentProvider } from './paypalPaymentProvider';
import { MockPaymentProvider } from './mockPaymentProvider';
import { ManualPaymentProvider } from './manualPaymentProvider';

export interface PaymentProviderConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  webhookId: string;
  nodeEnv: 'development' | 'test' | 'production';
  /** 'manual' forces bank-transfer mode even when gateway credentials exist. */
  paymentMode: 'auto' | 'manual';
}

/**
 * PayPal when credentials exist (unless manual mode is forced). Without credentials, production
 * falls back to manual bank-transfer payment confirmed by an admin; the auto-approving mock is
 * only ever used outside production.
 */
export function createPaymentProvider(cfg: PaymentProviderConfig): PaymentProvider {
  if (cfg.paymentMode === 'manual') {
    return new ManualPaymentProvider();
  }
  if (cfg.clientId && cfg.clientSecret) {
    return new PayPalPaymentProvider(cfg.clientId, cfg.clientSecret, cfg.mode, cfg.webhookId);
  }
  if (cfg.nodeEnv === 'production') {
    logger.warn('No payment gateway configured in production - using manual (bank transfer) payment');
    return new ManualPaymentProvider();
  }
  return new MockPaymentProvider();
}

export function isManualPayment(provider: PaymentProvider): boolean {
  return provider instanceof ManualPaymentProvider;
}

export const paymentProvider: PaymentProvider = createPaymentProvider({
  clientId: env.PAYPAL_CLIENT_ID,
  clientSecret: env.PAYPAL_CLIENT_SECRET,
  mode: env.PAYPAL_MODE,
  webhookId: env.PAYPAL_WEBHOOK_ID,
  nodeEnv: env.NODE_ENV,
  paymentMode: env.PAYMENT_MODE,
});

export * from './paymentProvider.types';
