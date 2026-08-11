import { Client, Environment, OrdersController, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
import {
  CaptureOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
} from './paymentProvider.types';

export class PayPalPaymentProvider implements PaymentProvider {
  private ordersController: OrdersController;

  constructor(clientId: string, clientSecret: string, mode: 'sandbox' | 'live') {
    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 0,
      environment: mode === 'live' ? Environment.Production : Environment.Sandbox,
    });
    this.ordersController = new OrdersController(client);
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { result } = await this.ordersController.ordersCreate({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: input.referenceId,
            amount: {
              currencyCode: input.currency,
              value: input.amount.toFixed(2),
            },
          },
        ],
      },
    });

    const approveLink = result.links?.find((link) => link.rel === 'approve');

    return {
      providerOrderId: result.id ?? '',
      approveUrl: approveLink?.href ?? null,
    };
  }

  async captureOrder(providerOrderId: string): Promise<CaptureOrderResult> {
    const { result } = await this.ordersController.ordersCapture({ id: providerOrderId });

    const capturedPaymentId =
      result.purchaseUnits?.[0]?.payments?.captures?.[0]?.id ?? null;

    return {
      status: result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
      providerPaymentId: capturedPaymentId,
      raw: result,
    };
  }
}
