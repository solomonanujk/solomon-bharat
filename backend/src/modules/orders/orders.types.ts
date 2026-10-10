import { Address, Brand, Order, OrderItem, OrderStatus, Prisma, ProductImage } from '@prisma/client';

export type PricingRole = 'BUYER' | 'AGENT';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
  /** Which variant of the product, if it has any — pricing is per-variant, not per-product. */
  variantId?: string;
}

export interface PricedOrderItem {
  productId: string;
  variantId?: string;
  sellerId: string;
  /** Set for marketplace-brand products; null = Solomon-curated. */
  brandId: string | null;
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
  /** Brand's SellerProfile id for a brand order; null/undefined for a curated order. */
  sellerProfileId?: string | null;
  checkoutId?: string;
}

/** The slice of Brand that checkout needs. */
export type CheckoutBrand = Pick<Brand, 'id' | 'sellerProfileId' | 'name' | 'status' | 'minOrderValueInr'>;

export interface MinOrderViolation {
  brandId: string;
  brandName: string;
  required: number;
  current: number;
}

export interface PendingCheckout {
  checkoutId: string;
  orders: OrderWithItems[];
}

/** Resolves a brand's commission rates (brands module owns the real implementation). */
export interface CommissionRatesPort {
  resolveCommissionRates(brandId: string): Promise<{ first: number; repeat: number }>;
}

export type DbTx = Prisma.TransactionClient;

export interface BrandSummaryLite {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
  minOrderValueInr: number;
}

export type OrderItemWithProduct = OrderItem & {
  product: {
    name: string;
    images: ProductImage[];
    brand?: Pick<Brand, 'id' | 'name' | 'slug' | 'logoUrl' | 'isVerified' | 'minOrderValueInr'> | null;
  };
  variant: { type: string; value: string } | null;
  review: { id: string } | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
  sellerProfile?: { brand: { name: string; slug: string } | null } | null;
};

/** Buyer-safe projection — never includes sellerPriceTotal, adminMargin, or item sellerPrice. */
export interface BuyerOrder {
  id: string;
  checkoutId: string | null;
  /** Marketplace brand that fulfils this order; null for Solomon-curated orders. */
  brand: { name: string; slug: string } | null;
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
    variantLabel: string | null;
    quantity: number;
    unitAdminPrice: string;
    lineAdminTotal: string;
    reviewed: boolean;
    brand: BrandSummaryLite | null;
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

export type BrandOrderRecord = Order & {
  items: (OrderItem & {
    product: { name: string; images: ProductImage[] };
    variant: { type: string; value: string } | null;
  })[];
  buyer: { contactName: string; phone: string | null; companyName: string | null; country: string };
  shippingAddress: Address | null;
};

/** What a marketplace brand sees of ITS OWN order: buyer name/phone/address are needed to ship. */
export interface BrandOrderView {
  id: string;
  checkoutId: string | null;
  status: OrderStatus;
  trackingNumber: string | null;
  cancelledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Gross (what the buyer paid for this brand's items), INR. */
  grossTotal: string;
  /** Total commission, INR; null until the order is paid. */
  commissionTotal: string | null;
  /** Gross minus commission, INR; null until the order is paid. */
  netTotal: string | null;
  buyer: { name: string; company: string | null; phone: string | null; country: string };
  shippingAddress: {
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  } | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
    variantLabel: string | null;
    quantity: number;
    unitPrice: string;
    lineGross: string;
    commissionRate: string | null;
    commissionAmount: string | null;
    lineNet: string | null;
  }[];
}

export interface AdminOrderListFilter {
  status?: OrderStatus;
  buyerId?: string;
  placedAsAgent?: boolean;
}

export { OrderStatus };
