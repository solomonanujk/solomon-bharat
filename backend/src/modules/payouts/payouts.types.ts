import { PayoutStatus, SellerType } from '@prisma/client';

export interface PayoutListFilter {
  status?: PayoutStatus;
  sellerId?: string;
}

export interface SellerPayoutSummary {
  totalEarned: string;
  pendingPayout: string;
  lastPayout: { amount: string; paidAt: Date } | null;
  /** Flat aliases of `lastPayout` (the frontend type expects these names). */
  lastPayoutAmount: string | null;
  lastPayoutDate: Date | null;
}

/** Breakdown fields; null for curated payouts. */
export interface PayoutBreakdown {
  amount: string;
  grossAmount: string | null;
  commissionRate: string | null;
  commissionAmount: string | null;
}

export interface AdminPayoutSellerInfo {
  businessName: string;
  sellerType: SellerType;
  brandName: string | null;
}

export interface BrandSalesStats {
  ordersCount: number;
  gmv: number;
  commissionPaid: number;
  netEarned: number;
  pendingPayout: number;
  topProducts: { productId: string; name: string; units: number; revenue: number }[];
  last30Days: { date: string; orders: number; gmv: number }[];
}

export interface BrandStatsOrderRow {
  createdAt: Date;
  adminPriceTotal: { toString(): string };
}

export interface BrandStatsItemRow {
  productId: string;
  quantity: number;
  lineAdminTotal: { toString(): string };
  commissionAmount: { toString(): string } | null;
  lineSellerTotal: { toString(): string };
}

export { PayoutStatus };
