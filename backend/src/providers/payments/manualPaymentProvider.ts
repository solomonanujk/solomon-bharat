import { AppError } from '../../utils/errors';
import { CreateOrderInput, CreateOrderResult, PaymentProvider } from './paymentProvider.types';

/**
 * Bank transfer / offline payment while no online gateway is live. Checkout creates the orders
 * and PENDING Payment rows as usual, but there is nothing for the buyer to approve: an admin
 * confirms receipt of the money (POST /payments/admin/checkouts/:checkoutId/mark-paid), which
 * runs the same settle path as an online capture.
 */
export class ManualPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return { providerOrderId: `MANUAL-${input.referenceId}`, approveUrl: null };
  }

  async captureOrder(): Promise<never> {
    throw AppError.conflict('This order is awaiting payment confirmation by Solomon Bharat');
  }

  async verifyWebhook(): Promise<boolean> {
    return false;
  }
}
