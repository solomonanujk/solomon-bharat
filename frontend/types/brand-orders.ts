import type { CartItem, Order, OrderItem, OrderStatus } from '@/types'

/** Brand snapshot stored on a cart line (null/absent for Solomon-curated products). */
export interface CartItemBrand {
  id: string
  name: string
  slug: string
  minOrderValueInr: number
  /** Optional: carts saved before logos were stored fall back to the brand's initial. */
  logoUrl?: string | null
}

/** A cart line, optionally tagged with the marketplace brand that sells it. */
export type CartLine = CartItem & { brand?: CartItemBrand | null }

/** Cart lines of one fulfiller: a marketplace brand, or Solomon-curated (brand = null). */
export interface CartGroup {
  key: string
  brand: CartItemBrand | null
  items: CartLine[]
  subtotalInr: number
  /** 0 when no minimum applies. */
  minOrderValueInr: number
  /** INR still needed to reach the minimum; 0 when met or not applicable. */
  shortfallInr: number
}

/** One entry of `meta.details.details` on a 422 MIN_ORDER_VALUE_NOT_MET response. */
export interface MinOrderViolation {
  brandId: string
  brandName: string
  required: number
  current: number
}

export interface BrandTag {
  name: string
  slug: string
}

/** Buyer order extras returned by the backend (merged into the existing Order shape). */
export interface BuyerOrderBrandFields {
  checkoutId?: string | null
  brand?: BrandTag | null
}

export interface BuyerOrderItemBrand {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  isVerified: boolean
  minOrderValueInr: number
}

/** Statuses a marketplace-brand order moves through (no procurement/collection steps). */
export const BRAND_ORDER_STEPS: OrderStatus[] = ['PAYMENT_RECEIVED', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED']

/** Extra fields `POST /payments/checkout` now returns, on top of `CheckoutResult`. */
export interface CheckoutResultBrandFields {
  checkoutId?: string
  orders?: { orderId: string; sellerProfileId: string | null }[]
}

/** Invoice extra: set for marketplace-brand orders (Solomon collects payment on the brand's behalf). */
export interface InvoiceBrandFields {
  facilitatedBy?: string
}

export type BuyerOrderItem = OrderItem & { brand?: BuyerOrderItemBrand | null }

/** Buyer-facing order: the shared Order plus checkout grouping and the selling brand. */
export type BuyerOrder = Omit<Order, 'items'> & BuyerOrderBrandFields & { items: BuyerOrderItem[] }
