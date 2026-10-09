import { Client, Environment, OrdersController, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
import { logger } from '../../config/logger';
import { isProduction } from '../../config/env';
import {
  CaptureOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  WebhookHeaders,
} from './paymentProvider.types';

export class PayPalPaymentProvider implements PaymentProvider {
  private ordersController: OrdersController;

  private readonly apiBase: string;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    mode: 'sandbox' | 'live',
    private readonly webhookId: string = '',
  ) {
    this.apiBase = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
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

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal token request failed: ${res.status}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }

  /**
   * Verifies the webhook via PayPal's verify-webhook-signature API. Without PAYPAL_WEBHOOK_ID it
   * cannot verify: refused in production (fail closed), allowed with a warning elsewhere.
   */
  async verifyWebhook(headers: WebhookHeaders, rawBody: string): Promise<boolean> {
    if (!this.webhookId) {
      if (isProduction) {
        logger.error('PAYPAL_WEBHOOK_ID is not set - rejecting webhook');
        return false;
      }
      logger.warn('PAYPAL_WEBHOOK_ID is not set - skipping webhook signature verification (non-production)');
      return true;
    }
    const header = (name: string): string => {
      const v = headers[name];
      return (Array.isArray(v) ? v[0] : v) ?? '';
    };
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return false;
    }
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.apiBase}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_algo: header('paypal-auth-algo'),
          cert_url: header('paypal-cert-url'),
          transmission_id: header('paypal-transmission-id'),
          transmission_sig: header('paypal-transmission-sig'),
          transmission_time: header('paypal-transmission-time'),
          webhook_id: this.webhookId,
          webhook_event: event,
        }),
      });
      if (!res.ok) return false;
      return ((await res.json()) as { verification_status?: string }).verification_status === 'SUCCESS';
    } catch (err) {
      logger.error({ err }, 'PayPal webhook verification call failed');
      return false;
    }
  }
}
