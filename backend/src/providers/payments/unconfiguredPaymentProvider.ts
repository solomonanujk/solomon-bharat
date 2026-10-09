import { AppError } from '../../utils/errors';
import { PaymentProvider } from './paymentProvider.types';

/**
 * Used in production when PayPal credentials are missing. Fails closed: the mock provider
 * auto-approves and auto-captures, which must never be reachable on a live deployment.
 */
export class UnconfiguredPaymentProvider implements PaymentProvider {
  private fail(): never {
    throw new AppError(503, 'Payments are temporarily unavailable');
  }

  async createOrder(): Promise<never> {
    return this.fail();
  }

  async captureOrder(): Promise<never> {
    return this.fail();
  }

  async verifyWebhook(): Promise<boolean> {
    return false;
  }
}
