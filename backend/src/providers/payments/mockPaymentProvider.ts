import crypto from 'crypto';
import { logger } from '../../config/logger';
import {
  CaptureOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
} from './paymentProvider.types';

/**
 * Dev fallback so checkout works end-to-end without PayPal sandbox credentials.
 * Auto-approves and auto-captures — swap for PayPalPaymentProvider once
 * PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are configured (see payments/index.ts).
 */
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const providerOrderId = `MOCK-ORDER-${crypto.randomUUID()}`;
    logger.info(
      { providerOrderId, ...input },
      '[MockPaymentProvider] Order created — PayPal credentials not configured',
    );
    return { providerOrderId, approveUrl: null };
  }

  async captureOrder(providerOrderId: string): Promise<CaptureOrderResult> {
    const providerPaymentId = `MOCK-CAPTURE-${crypto.randomUUID()}`;
    logger.info(
      { providerOrderId, providerPaymentId },
      '[MockPaymentProvider] Order auto-captured — PayPal credentials not configured',
    );
    return { status: 'COMPLETED', providerPaymentId, raw: { mock: true, providerOrderId } };
  }
}
