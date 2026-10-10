import type { OrderStatus, Payout, PublicBrand } from '@/types'

/** Decimal-ish values from the API may arrive as strings. */
export type Numeric = number | string

export interface OwnBrand extends PublicBrand {
  status: 'ACTIVE' | 'SUSPENDED'
  legalName: string | null
  gstin: string | null
  commissionFirstOverride: Numeric | null
  commissionRepeatOverride: Numeric | null
  /** Rates (percent) that actually apply to this brand, override included. Absent on older backends. */
  effectiveCommission?: { first: number; repeat: number }
}

export interface UpdateOwnBrandInput {
  logoUrl?: string | null
  bannerUrl?: string | null
  story?: string | null
  country?: string | null
  website?: string | null
  instagram?: string | null
  returnPolicy?: string | null
  minOrderValueInr?: number
  legalName?: string | null
  gstin?: string | null
}

export interface BrandSalesStats {
  ordersCount: number
  gmv: number
  commissionPaid: number
  netEarned: number
  pendingPayout: number
  topProducts: { productId: string; name: string; units: number; revenue: number }[]
  last30Days: { date: string; orders: number; gmv: number }[]
}

export interface BrandOrderItemView {
  id: string
  productId: string
  productName: string
  productImage: string | null
  variantLabel: string | null
  quantity: number
  unitPrice: string
  lineGross: string
  commissionRate: string | null
  commissionAmount: string | null
  lineNet: string | null
}

export interface BrandOrderView {
  id: string
  checkoutId: string | null
  status: OrderStatus
  trackingNumber: string | null
  cancelledReason: string | null
  createdAt: string
  updatedAt: string
  grossTotal: string
  commissionTotal: string | null
  netTotal: string | null
  buyer: { name: string; company: string | null; phone: string | null; country: string }
  shippingAddress: {
    label: string | null
    line1: string
    line2: string | null
    city: string
    state: string | null
    postalCode: string
    country: string
  } | null
  items: BrandOrderItemView[]
}

export interface BrandShipInput {
  trackingNumber: string
  carrier?: string
}

/** Payout row incl. the marketplace breakdown (null for curated payouts). Money is string-encoded
 *  at runtime even where typed number, so always wrap in Number() before formatting. */
export interface BrandPayout extends Payout {
  grossAmount: string | null
  commissionRate: string | null
  commissionAmount: string | null
}
