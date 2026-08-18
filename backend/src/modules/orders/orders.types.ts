import { Order, OrderItem, OrderStatus, ProductImage } from '@prisma/client';

export type PricingRole = 'BUYER' | 'AGENT';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface PricedOrderItem {
  productId: string;
  sellerId: string;
  quantity: number;
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
}

export type OrderItemWithProduct = OrderItem & {
  product: { name: string; images: ProductImage[] };
  review: { id: string } | null;
};

export type OrderWithItems = Order & { items: OrderItemWithProduct[] };

/** Buyer-safe projection — never includes sellerPriceTotal, adminMargin, or item sellerPrice. */
export interface BuyerOrder {
  id: string;
  status: OrderStatus;
  adminPriceTotal: string;
  trackingNumber: string | null;
  exportDocuments: unknown;
  expectedCollectionDate: Date | null;
  cancelledReason: string | null;
  shippingAddressId: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
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
