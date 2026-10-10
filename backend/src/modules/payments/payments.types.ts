import { Payment, PaymentStatus } from '@prisma/client';

export interface CheckoutInput {
  items: { productId: string; quantity: number; variantId?: string }[];
  shippingAddressId?: string;
  currency: string;
}

export interface CheckoutResult {
  /** First sibling order (kept for older clients); see `orders` for all of them. */
  orderId: string;
  /** First Payment row; capturing it settles every Payment row of the checkout. */
  paymentId: string;
  checkoutId: string;
  /** One sibling order per brand (sellerProfileId set) plus at most one curated order (null). */
  orders: { orderId: string; sellerProfileId: string | null }[];
  approveUrl: string | null;
  adminPriceTotal: string;
  currency: string;
  chargeAmount: string;
}

export interface FxRateResult {
  base: string;
  currency: string;
  rate: number;
  date: string;
}

export interface CaptureResult {
  payment: Payment;
  orderId: string;
  status: PaymentStatus;
}

export interface InvoiceLineItem {
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Invoice {
  invoiceNumber: string;
  orderId: string;
  issuedAt: Date;
  soldBy: string;
  /** Set for marketplace-brand orders: Solomon collects payment on the brand's behalf. */
  facilitatedBy?: string;
  buyerEmail: string;
  currency: string;
  items: InvoiceLineItem[];
  total: string;
}

export { PaymentStatus };

/** The subset of a PayPal webhook event this platform reads. */
export interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}
