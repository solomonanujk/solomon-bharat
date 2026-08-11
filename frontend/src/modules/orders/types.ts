export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_RECEIVED'
  | 'CONFIRMED'
  | 'PROCURING'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export interface BuyerOrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitAdminPrice: string;
  lineAdminTotal: string;
}

export interface BuyerOrder {
  id: string;
  status: OrderStatus;
  adminPriceTotal: string;
  trackingNumber: string | null;
  exportDocuments: unknown;
  expectedCollectionDate: string | null;
  cancelledReason: string | null;
  shippingAddressId: string | null;
  createdAt: string;
  updatedAt: string;
  items: BuyerOrderItem[];
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
  expectedCollectionDate: string | null;
  createdAt: string;
}

export interface AdminOrderItem {
  id: string;
  productId: string;
  sellerId: string;
  quantity: number;
  unitAdminPrice: string;
  unitSellerPrice: string;
  lineAdminTotal: string;
  lineSellerTotal: string;
  product: { name: string; images: { url: string }[] };
}

export interface AdminOrder {
  id: string;
  buyerId: string;
  status: OrderStatus;
  adminPriceTotal: string;
  sellerPriceTotal: string;
  adminMargin: string;
  trackingNumber: string | null;
  expectedCollectionDate: string | null;
  cancelledReason: string | null;
  shippingAddressId: string | null;
  createdAt: string;
  items: AdminOrderItem[];
}

export interface AdminOrderListFilter {
  status?: OrderStatus;
  buyerId?: string;
}
