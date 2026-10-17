import { Order, OrderItem, OrderStatus, Prisma, ProductImage } from '@prisma/client';

export type PricingRole = 'BUYER' | 'AGENT';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
  /** Which variant of the product, if it has any — pricing is per-variant, not per-product. */
  variantId?: string;
  /** Buy as a sample: sample price, no MOQ, up to the sample limit. */
  isSample?: boolean;
}

export type QuoteLineStatus =
  | 'OK'
  | 'UNAVAILABLE'
  | 'OPTION_CHANGED'
  | 'CHOOSE_OPTION'
  | 'BELOW_MOQ'
  | 'SAMPLE_UNAVAILABLE'
  | 'ABOVE_SAMPLE_LIMIT';

export interface QuoteLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  isSample: boolean;
  status: QuoteLineStatus;
  message?: string;
  unitPriceInr?: number;
  lineTotalInr?: number;
  moq: number;
}

export interface QuoteResult {
  lines: QuoteLine[];
  subtotalInr: number;
}

export interface PricedOrderItem {
  productId: string;
  variantId?: string;
  sellerId: string;
  quantity: number;
  isSample?: boolean;
  unitAdminPrice: number;
  unitSellerPrice: number;
  lineAdminTotal: number;
  lineSellerTotal: number;
}

export interface CreatePendingOrderInput {
  buyerId: string;
  shippingAddressId?: string;
  items: PricedOrderItem[];
  adminPriceTotal: number;
  sellerPriceTotal: number;
  adminMargin: number;
  placedAsAgent: boolean;
  checkoutId?: string;
}

export interface PendingCheckout {
  checkoutId: string;
  orders: OrderWithItems[];
}

export type DbTx = Prisma.TransactionClient;

export type OrderItemWithProduct = OrderItem & {
  product: {
    name: string;
    images: ProductImage[];
  };
  variant: { type: string; value: string } | null;
  review: { id: string } | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
};

/** Buyer-safe projection — never includes sellerPriceTotal, adminMargin, or item sellerPrice. */
export interface BuyerOrder {
  id: string;
  checkoutId: string | null;
  status: OrderStatus;
  adminPriceTotal: string;
  trackingNumber: string | null;
  exportDocuments: unknown;
  expectedCollectionDate: Date | null;
  cancelledReason: string | null;
  paidAt: Date | null;
  dispatchPhotos: string[];
  refundedAt: Date | null;
  shippingAddressId: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
    variantLabel: string | null;
    isSample: boolean;
    quantity: number;
    unitAdminPrice: string;
    lineAdminTotal: string;
    reviewed: boolean;
  }[];
}

/** Seller-safe projection — one row per owned order item, never buyer info or admin price. */
export interface SellerOrderItem {
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  sellerPrice: string;
  lineSellerTotal: string;
  status: OrderStatus;
  expectedCollectionDate: Date | null;
  createdAt: Date;
}

export interface AdminOrderListFilter {
  status?: OrderStatus;
  buyerId?: string;
  placedAsAgent?: boolean;
}

export { OrderStatus };
