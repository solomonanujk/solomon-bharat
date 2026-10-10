export interface CreateOrderInput {
  amount: number;
  currency: string;
  referenceId: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  approveUrl: string | null;
}

export interface CaptureOrderResult {
  status: 'COMPLETED' | 'FAILED';
  providerPaymentId: string | null;
  raw: unknown;
}

/** Lower-cased HTTP headers of an incoming webhook request. */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  captureOrder(providerOrderId: string): Promise<CaptureOrderResult>;
  /** True when the webhook really came from the provider. Raw (unparsed) body is required. */
  verifyWebhook(headers: WebhookHeaders, rawBody: string): Promise<boolean>;
}
