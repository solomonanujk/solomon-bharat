export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  items: CheckoutItemInput[];
  shippingAddressId?: string;
}

export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  approveUrl: string | null;
  adminPriceTotal: string;
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface CaptureResult {
  payment: {
    id: string;
    orderId: string;
    status: PaymentStatus;
  };
  orderId: string;
  status: PaymentStatus;
}
