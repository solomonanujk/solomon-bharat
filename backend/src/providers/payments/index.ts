import { env } from '../../config/env';
import { PaymentProvider } from './paymentProvider.types';
import { PayPalPaymentProvider } from './paypalPaymentProvider';
import { MockPaymentProvider } from './mockPaymentProvider';

export const paymentProvider: PaymentProvider =
  env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET
    ? new PayPalPaymentProvider(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET, env.PAYPAL_MODE)
    : new MockPaymentProvider();

export * from './paymentProvider.types';
