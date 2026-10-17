import type { CartItem, Order, Payout } from '@/types'

/** A cart line. */
export type CartLine = CartItem

/** Buyer-facing order: the shared Order plus its checkout grouping. */
export type BuyerOrder = Order & { checkoutId?: string | null }

/** Extra fields `POST /payments/checkout` returns, on top of `CheckoutResult`. */
export interface CheckoutResultExtras {
  checkoutId?: string
  orders?: { orderId: string; sellerProfileId: string | null }[]
}

/** Invoice extra: only set on historical marketplace-brand orders (model removed Oct 2026). */
export interface InvoiceExtras {
  facilitatedBy?: string
}

/** Admin payout row: the base payout plus the seller's business name. */
export interface AdminPayout extends Payout {
  seller?: { businessName?: string }
}

/** Raw admin order fields. sellerProfileId is only set on historical marketplace-brand orders. */
export interface AdminOrderFields {
  sellerProfileId?: string | null
  checkoutId?: string | null
}
