import { Payment, PaymentStatus } from '@prisma/client';

export interface CheckoutInput {
  items: { productId: string; quantity: number }[];
  shippingAddressId?: string;
}

export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  approveUrl: string | null;
  adminPriceTotal: string;
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
  buyerEmail: string;
  currency: string;
  items: InvoiceLineItem[];
  total: string;
}

export { PaymentStatus };
