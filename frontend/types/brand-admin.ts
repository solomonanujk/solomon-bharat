import type { Payout, SellerType } from '@/types'

export type BrandStatus = 'ACTIVE' | 'SUSPENDED'

/** One row of GET /brands/admin. Decimal columns are normalised to numbers by the backend. */
export interface AdminBrand {
  id: string
  sellerProfileId: string
  name: string
  slug: string
  logoUrl: string | null
  country: string | null
  isVerified: boolean
  status: BrandStatus
  minOrderValueInr: number
  commissionFirstOverride: number | null
  commissionRepeatOverride: number | null
  productCount: number
  followerCount: number
  createdAt: string
  seller: {
    id: string
    businessName: string
    contactName: string
    phone: string | null
    email: string
  }
  orderStats: { ordersCount: number; gmv: number }
}

export interface AdminBrandListParams {
  status?: BrandStatus
  search?: string
  page?: number
  limit?: number
}

export interface AdminBrandUpdateInput {
  isVerified?: boolean
  status?: BrandStatus
  name?: string
  commissionFirstOverride?: number | null
  commissionRepeatOverride?: number | null
}

export interface CommissionDefaults {
  first: number
  repeat: number
}

/** Additive marketplace fields on the admin dashboard payload (decimals may arrive as strings). */
export interface AdminDashboardBrandFields {
  commissionEarned?: number | string
  brandGmv?: number | string
}

export interface BrandRevenueRow {
  sellerProfileId: string
  brandName: string
  ordersCount: number
  gmv: number | string
  commission: number | string
}

/** Revenue report row additions (admin reports `revenue` type). */
export interface RevenueReportBrandFields {
  commissionEarned?: number | string
  brandGmv?: number | string
  brands?: BrandRevenueRow[]
}

/** Payout/seller identity additions on admin payout rows. */
export interface PayoutSellerInfo {
  businessName?: string
  sellerType?: SellerType
  brandName?: string | null
}

/** Admin payout row: the base payout plus marketplace breakdown and seller identity. */
export interface AdminPayout extends Payout {
  grossAmount?: string | number | null
  commissionRate?: string | number | null
  commissionAmount?: string | number | null
  seller?: PayoutSellerInfo
}

/** Brand fields on admin order payloads (raw order row plus the joined brand name). */
export interface AdminOrderBrandFields {
  /** Set for marketplace brand orders, null for Solomon-curated ones. */
  sellerProfileId?: string | null
  checkoutId?: string | null
  sellerProfile?: { brand: { name: string; slug: string } | null } | null
}

/** Brand fields on admin product payloads. */
export interface AdminProductBrandFields {
  brand?: { id: string; name: string; slug: string; logoUrl?: string | null; isVerified?: boolean; status?: BrandStatus } | null
}

/** Seller type + brand fields on admin seller payloads. */
export interface AdminSellerTypeFields {
  sellerType?: SellerType
  brand?: { id?: string; name: string; slug?: string; status?: BrandStatus; isVerified?: boolean } | null
}
