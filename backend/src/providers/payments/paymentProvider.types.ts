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

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  captureOrder(providerOrderId: string): Promise<CaptureOrderResult>;
}
